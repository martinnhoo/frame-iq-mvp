/**
 * PerformanceDashboard — real-time ad metrics via live-metrics API.
 *
 * DATA CONTRACT:
 * - Source: `live-metrics` edge function → Meta Ads API (real-time)
 * - Units: REAIS (float) for money, DECIMAL (float, 0.015 = 1.5%) for CTR, RATIO (float) for ROAS
 * - This is DIFFERENT from FeedPage which uses `ad_metrics` table (centavos, basis points)
 * - Do NOT pass values between PerformanceDashboard and FeedPage without unit conversion
 */
import { storage } from "@/lib/storage";
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw, DollarSign, MousePointer, Target, Eye,
  AlertCircle, ChevronLeft, ChevronRight,
  Settings2, X, Calendar, Check, TrendingUp,
  BarChart3, Activity, Users, Repeat
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { DESIGN_TOKENS as T } from "@/hooks/useDesignTokens";
// AdDiary moved to Ad Score page
import { SparklineCard } from "@/components/ui/SparklineCard";
import { Reveal } from "@/components/ui/Reveal";
import { ResponsiveLine } from "@nivo/line";
import { ADBRIEF_TOKENS as TK } from "@/styles/tokens";

// ── Design tokens — from unified design system ──────────────────────────────
const F = T.font; // 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif
const MONO = T.mono; // 'Space Grotesk', 'DM Mono', monospace
const BG = T.surface0; // #070d1a
const TX = T.textPrimary; // #f0f2f8
const MT = T.textMuted; // rgba(255,255,255,0.45)
const A = T.accent; // #0ea5e9
const GREEN = T.green; // #22A3A3
const RED = T.red; // #ef4444
const AMBER = T.amber; // #eab308

// ── Metrics ──────────────────────────────────────────────────────────────────
type MetricKey = "spend"|"ctr"|"clicks"|"impressions"|"conversions"|"roas"|"cpa"|"cpm"|"cpc"|"reach"|"frequency"|"conv_value";

interface MetricDef {
  key: MetricKey; label: string; labelPt: string; labelEs: string;
  icon: any; format: (v: number, lang?: string) => string;
  higherIsBetter: boolean; platforms: ("meta"|"both")[];
}

const METRICS: MetricDef[] = [
  { key:"spend",       label:"Ad Spend",    labelPt:"Investido",    labelEs:"Invertido",    icon:DollarSign,  format:(v,lang)=>{ const s=lang==="pt"?"R$":"$"; if(v>=1e6)return s+(v/1e6).toFixed(1)+"M"; if(v>=1000)return s+(v/1000).toFixed(1)+"k"; return s+v.toFixed(0); },    higherIsBetter:false, platforms:["both"]   },
  { key:"ctr",         label:"CTR",         labelPt:"CTR",          labelEs:"CTR",          icon:MousePointer,format:(v)=>`${(v*100).toFixed(2)}%`,                                higherIsBetter:true,  platforms:["both"]   },
  { key:"clicks",      label:"Clicks",      labelPt:"Cliques",      labelEs:"Clics",        icon:Target,      format:(v)=>v>=1000?(v/1000).toFixed(1)+"k":String(Math.round(v)), higherIsBetter:true,  platforms:["both"]   },
  { key:"impressions", label:"Impressions", labelPt:"Impressões",   labelEs:"Impresiones",  icon:Eye,         format:(v)=>{ if(v>=1e6)return (v/1e6).toFixed(1)+"M"; if(v>=1000)return (v/1000).toFixed(0)+"k"; return String(Math.round(v)); }, higherIsBetter:true,  platforms:["both"]   },
  { key:"conversions", label:"Conversions", labelPt:"Conversões",   labelEs:"Conversiones", icon:TrendingUp,  format:(v)=>String(Math.round(v)),                                   higherIsBetter:true,  platforms:["both"]   },
  { key:"roas",        label:"ROAS",        labelPt:"ROAS",         labelEs:"ROAS",         icon:BarChart3,   format:(v)=>`${v.toFixed(2)}×`,                                      higherIsBetter:true,  platforms:["both"]   },
  { key:"cpa",         label:"CPA",         labelPt:"CPA",          labelEs:"CPA",          icon:Activity,    format:(v,lang)=>{ const s=lang==="pt"?"R$":"$"; if(v>=1000)return s+(v/1000).toFixed(1)+"k"; return s+v.toFixed(0); },                                      higherIsBetter:false, platforms:["both"]   },
  { key:"cpm",         label:"CPM",         labelPt:"CPM",          labelEs:"CPM",          icon:Users,       format:(v,lang)=>(lang==="pt"?"R$":"$")+v.toFixed(2),                higherIsBetter:false, platforms:["meta"]   },
  { key:"cpc",         label:"CPC",         labelPt:"CPC",          labelEs:"CPC",          icon:Repeat,      format:(v,lang)=>(lang==="pt"?"R$":"$")+v.toFixed(2),                higherIsBetter:false, platforms:["both"]   },
  { key:"reach",       label:"Reach",       labelPt:"Alcance",      labelEs:"Alcance",      icon:Users,       format:(v)=>{ if(v>=1e6)return (v/1e6).toFixed(1)+"M"; if(v>=1000)return (v/1000).toFixed(0)+"k"; return String(Math.round(v)); }, higherIsBetter:true,  platforms:["meta"]   },
  { key:"frequency",   label:"Frequency",   labelPt:"Frequência",   labelEs:"Frecuencia",   icon:Repeat,      format:(v)=>v.toFixed(2),                                            higherIsBetter:false, platforms:["meta"]   },
  { key:"conv_value",  label:"Conv. Value", labelPt:"Valor Conv.",  labelEs:"Valor Conv.",  icon:DollarSign,  format:(v,lang)=>{ const s=lang==="pt"?"R$":"$"; if(v>=1e6)return s+(v/1e6).toFixed(1)+"M"; if(v>=1000)return s+(v/1000).toFixed(1)+"k"; return s+v.toFixed(0); },    higherIsBetter:true,  platforms:["both"]   },
];

const DEFAULT_METRICS: MetricKey[] = ["spend","ctr","clicks","roas","conversions","cpa"];

const FORMAT_MAP: Record<MetricKey, "currency"|"percent"|"number"|"roas"> = {
  spend: "currency", ctr: "percent", clicks: "number", impressions: "number",
  conversions: "number", roas: "roas", cpa: "currency", cpm: "currency",
  cpc: "currency", reach: "number", frequency: "number", conv_value: "currency"
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d: Date) => d.toISOString().split("T")[0];
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const fmtLabel = (d: Date) => d.toLocaleDateString("pt-BR", { day:"2-digit", month:"short" });

function getMetricValue(d: any, key: MetricKey): number {
  if (!d) return 0;
  switch(key) {
    case "spend":       return d.spend||0;
    case "ctr":         return d.ctr||0;
    case "clicks":      return d.clicks||0;
    case "impressions": return d.impressions||0;
    case "conversions": return d.conversions||0;
    case "roas":        return d.roas||0;
    case "cpa":         return d.cpa||0;
    case "cpm":         return (d.impressions&&d.spend)?(d.spend/d.impressions)*1000:0;
    case "cpc":         return (d.clicks&&d.spend)?d.spend/d.clicks:0;
    case "reach":       return d.reach||0;
    case "frequency":   return d.frequency||0;
    case "conv_value":  return d.conv_value||0;
    default:            return 0;
  }
}

// ── Section filter config ────────────────────────────────────────────────────
type SectionKey = "cards"|"trend";
const SECTION_DEFS: {key:SectionKey;label:string}[] = [
  {key:"cards",label:"Métricas"},{key:"trend",label:"Tendência"}
];

// ── Calendar Date Picker ─────────────────────────────────────────────────────
interface DateRange { from: Date; to: Date; }
const PRESETS = [{label:"7D",days:7},{label:"14D",days:14},{label:"30D",days:30},{label:"60D",days:60},{label:"90D",days:90}];

function CalendarPicker({ value, onChange, onClose }: { value: DateRange; onChange: (r: DateRange) => void; onClose: () => void }) {
  const today = useMemo(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; },[]);
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(),today.getMonth(),1));
  const [selecting, setSelecting] = useState<"from"|"to">("from");
  const [hovered, setHovered] = useState<Date|null>(null);
  const [draft, setDraft] = useState<{from:Date|null;to:Date|null}>({from:value.from,to:value.to});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const handler=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) onClose(); };
    setTimeout(()=>document.addEventListener("mousedown",handler),0);
    return ()=>document.removeEventListener("mousedown",handler);
  },[onClose]);

  const daysInMonth=(y:number,m:number)=>new Date(y,m+1,0).getDate();
  const firstDay=(y:number,m:number)=>new Date(y,m,1).getDay();

  const renderMonth=(base:Date)=>{
    const y=base.getFullYear(),m=base.getMonth();
    const days=daysInMonth(y,m),fd=firstDay(y,m);
    const cells:Array<Date|null>=[];
    for(let i=0;i<fd;i++) cells.push(null);
    for(let d=1;d<=days;d++) cells.push(new Date(y,m,d));
    const inRange=(d:Date)=>{
      const f=draft.from,t=draft.to||hovered;
      if(!f||!t) return false;
      const lo=f<t?f:t,hi=f<t?t:f;
      return d>lo&&d<hi;
    };
    const isEnd=(d:Date)=>(draft.from&&fmt(d)===fmt(draft.from))||(draft.to&&fmt(d)===fmt(draft.to));
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <button onClick={()=>setViewMonth(new Date(y,m-1,1))} style={{background:"none",border:"none",color:MT,cursor:"pointer",padding:4,borderRadius:6,display:"flex"}}><ChevronLeft size={16}/></button>
          <span style={{fontFamily:F,fontSize:13,fontWeight:700,color:TX}}>{base.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</span>
          <button onClick={()=>setViewMonth(new Date(y,m+1,1))} style={{background:"none",border:"none",color:MT,cursor:"pointer",padding:4,borderRadius:6,display:"flex"}}><ChevronRight size={16}/></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {["D","S","T","Q","Q","S","S"].map((d,i)=>(
            <div key={i} style={{textAlign:"center",fontSize:12,fontWeight:600,color:MT,padding:"4px 0",fontFamily:F}}>{d}</div>
          ))}
          {cells.map((d,i)=>{
            if(!d) return <div key={i}/>;
            const inR=inRange(d),isE=isEnd(d),isFuture=d>today;
            return (
              <div key={i}
                onClick={()=>{
                  if(isFuture) return;
                  if(selecting==="from"||(draft.from&&d<draft.from)){
                    setDraft({from:d,to:null}); setSelecting("to");
                  } else {
                    const r={from:draft.from!,to:d};
                    setDraft(r); onChange(r); setSelecting("from"); onClose();
                  }
                }}
                onMouseEnter={()=>!isFuture&&setHovered(d)}
                onMouseLeave={()=>setHovered(null)}
                style={{
                  textAlign:"center",padding:"6px 0",borderRadius:8,cursor:isFuture?"default":"pointer",
                  fontSize:12,fontFamily:F,fontWeight:isE?700:400,
                  background:isE?A:inR?`${A}22`:"transparent",
                  color:isE?"#fff":isFuture?"rgba(255,255,255,0.15)":inR?A:TX,
                  transition:"all 0.1s",
                }}>{d.getDate()}</div>
            );
          })}
        </div>
      </div>
    );
  };

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <div ref={ref} style={{
      position: isMobile ? "fixed" : "absolute",
      top: isMobile ? "50%" : "calc(100% + 8px)",
      left: isMobile ? "50%" : "auto",
      right: isMobile ? "auto" : 0,
      transform: isMobile ? "translate(-50%, -50%)" : "none",
      zIndex: 999,
      background:"#0c0e14",border:`1px solid ${A}20`,borderRadius:16,
      boxShadow:`0 20px 60px rgba(0,0,0,0.7),0 0 40px ${A}08`,
      padding:"clamp(12px,3vw,20px)",
      width: isMobile ? "calc(100vw - 32px)" : "min(560px, calc(100vw - 24px))",
      maxWidth:"calc(100vw - 24px)",
      maxHeight: isMobile ? "85vh" : "none",
      overflowY: isMobile ? "auto" : "visible",
      display:"flex",flexDirection:"column",gap:16,
    }}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
        {PRESETS.map(p=>{
          const from=addDays(today,-p.days+1);
          const active=fmt(value.from)===fmt(from)&&fmt(value.to)===fmt(today);
          return (
            <button key={p.days} onClick={()=>{onChange({from,to:today});onClose();}}
              style={{fontFamily:MONO,fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:8,border:`1px solid ${active?A+"60":A+"15"}`,background:active?`${A}15`:"transparent",color:active?A:MT,cursor:"pointer",transition:"all 0.15s"}}>
              {p.label}
            </button>
          );
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}}>
        {renderMonth(viewMonth)}
        {renderMonth(new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,1))}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontFamily:F,fontSize:12,color:MT}}>{selecting==="from"?"Selecione a data inicial":"Selecione a data final"}</span>
        {draft.from&&<span style={{fontFamily:MONO,fontSize:12,color:A,fontWeight:600}}>{fmtLabel(draft.from)} {draft.to?`→ ${fmtLabel(draft.to)}`:"→ ..."}</span>}
      </div>
    </div>
  );
}

// ── Metric Customizer ────────────────────────────────────────────────────────
function MetricCustomizer({ active, platform, onChange, onClose }: { active: MetricKey[]; platform:"meta"; onChange:(k:MetricKey[])=>void; onClose:()=>void }) {
  const ref = useRef<HTMLDivElement>(null);
  const available = METRICS.filter(m=>m.platforms.includes("both")||m.platforms.includes(platform));
  useEffect(()=>{
    const handler=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) onClose(); };
    setTimeout(()=>document.addEventListener("mousedown",handler),0);
    return ()=>document.removeEventListener("mousedown",handler);
  },[onClose]);
  const toggle=(key:MetricKey)=>{
    if(active.includes(key)){ if(active.length<=2) return; onChange(active.filter(k=>k!==key)); }
    else onChange([...active,key]);
  };
  return (
    <div ref={ref} style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:999,background:"#0c0e14",border:`1px solid ${A}20`,borderRadius:16,boxShadow:`0 24px 64px rgba(0,0,0,0.7),0 0 40px ${A}08`,padding:20,width:300}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <span style={{fontFamily:F,fontSize:14,fontWeight:700,color:TX}}>Personalizar métricas</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:MT,cursor:"pointer",display:"flex"}}><X size={14}/></button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {available.map(m=>{
          const Icon=m.icon; const isActive=active.includes(m.key);
          return (
            <button key={m.key} onClick={()=>toggle(m.key)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,border:`1px solid ${isActive?A+"30":A+"10"}`,background:isActive?`${A}08`:"transparent",cursor:"pointer",textAlign:"left",width:"100%",transition:"all 0.15s"}}>
              <div style={{width:26,height:26,borderRadius:8,background:isActive?`${A}15`:"rgba(255,255,255,0.03)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Icon size={12} color={isActive?A:MT}/>
              </div>
              <span style={{flex:1,fontFamily:F,fontSize:13,fontWeight:isActive?600:400,color:isActive?TX:MT}}>{m.labelPt}</span>
              <div style={{width:17,height:17,borderRadius:"50%",border:`1.5px solid ${isActive?A:A+"30"}`,background:isActive?A:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {isActive&&<Check size={9} color="#fff" strokeWidth={3}/>}
              </div>
            </button>
          );
        })}
      </div>
      <p style={{fontFamily:MONO,fontSize:11,color:MT,marginTop:10,textAlign:"center"}}>{active.length}/{available.length} ativas</p>
    </div>
  );
}


// ── Meta logo SVG (official gradient wordmark) ──────────────────────────────
function MetaLogo({ size=14 }: {size?:number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#pm0)"/>
      <path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#pm1)"/>
      <path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#pm2)"/>
      <path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#pm3)"/>
      <path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#pm4)"/>
      <path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#pm5)"/>
      <path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"/>
      <path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#pm6)"/>
      <path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"/>
      <path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#pm7)"/>
      <path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#pm8)"/>
      <path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#pm9)"/>
      <path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#pm10)"/>
      <path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#pm11)"/>
      <path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#pm12)"/>
      <defs>
        <linearGradient id="pm0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stopColor="#0867DF"/><stop offset="45.39%" stopColor="#0668E1"/><stop offset="85.91%" stopColor="#0064E0"/></linearGradient>
        <linearGradient id="pm1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stopColor="#0064DF"/><stop offset="99.88%" stopColor="#0064E0"/></linearGradient>
        <linearGradient id="pm2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stopColor="#0072EC"/><stop offset="68.81%" stopColor="#0064DF"/></linearGradient>
        <linearGradient id="pm3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stopColor="#007CF6"/><stop offset="99.43%" stopColor="#0072EC"/></linearGradient>
        <linearGradient id="pm4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stopColor="#007FF9"/><stop offset="100%" stopColor="#007CF6"/></linearGradient>
        <linearGradient id="pm5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stopColor="#007FF9"/><stop offset="100%" stopColor="#0082FB"/></linearGradient>
        <linearGradient id="pm6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stopColor="#007FF8"/><stop offset="91.41%" stopColor="#0082FB"/></linearGradient>
        <linearGradient id="pm7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stopColor="#0082FB"/><stop offset="99.95%" stopColor="#0081FA"/></linearGradient>
        <linearGradient id="pm8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stopColor="#0081FA"/><stop offset="100%" stopColor="#0080F9"/></linearGradient>
        <linearGradient id="pm9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stopColor="#027AF3"/><stop offset="100%" stopColor="#0080F9"/></linearGradient>
        <linearGradient id="pm10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stopColor="#0377EF"/><stop offset="99.94%" stopColor="#0279F1"/></linearGradient>
        <linearGradient id="pm11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stopColor="#0471E9"/><stop offset="100%" stopColor="#0377EF"/></linearGradient>
        <linearGradient id="pm12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stopColor="#0867DF"/><stop offset="100%" stopColor="#0471E9"/></linearGradient>
      </defs>
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PerformanceDashboard() {
  usePageTitle("Performance");
  const {user,selectedPersona} = useOutletContext<DashboardContext>();
  const {language} = useLanguage();
  const navigate = useNavigate();
  const lang = language as "pt"|"es"|"en";

  const today = useMemo(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; },[]);
  const [dateRange, setDateRange] = useState<DateRange>({from:addDays(today,-6),to:today});
  const [showCalendar, setShowCalendar] = useState(false);
  const [activePlatform] = useState<"meta">("meta");
  // Tab removed — Performance is metrics-only now
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(()=>storage.getJSON("adbrief_perf_metrics", DEFAULT_METRICS));
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [dragging, setDragging] = useState<number|null>(null);
  const [dragOver, setDragOver] = useState<number|null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadingRef = useRef(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date|null>(null);
  const [visibleSections, setVisibleSections] = useState<Set<SectionKey>>(new Set(["cards","trend"]));

  useEffect(()=>{ storage.setJSON("adbrief_perf_metrics", activeMetrics); },[activeMetrics]);

  const load = useCallback(async(showSpinner=false)=>{
    if(!user||!selectedPersona) { setLoading(false); return; }
    if(loadingRef.current) return; // debounce: skip if already in-flight
    loadingRef.current = true;
    const loadPersonaId = selectedPersona.id;
    if(showSpinner) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const days=Math.round((dateRange.to.getTime()-dateRange.from.getTime())/86400000)+1;
      const period=days<=7?"7d":days<=14?"14d":days<=30?"30d":days<=60?"60d":"90d";
      const selectedAccId = storage.get(`meta_sel_${loadPersonaId}`, "") || undefined;
      const res=await supabase.functions.invoke("live-metrics",{body:{user_id:user.id,persona_id:loadPersonaId,period,date_from:fmt(dateRange.from),date_to:fmt(dateRange.to),account_id:selectedAccId}});
      if(res.error) throw new Error(res.error.message);
      // Context guard: discard stale response if persona changed during fetch
      if(loadPersonaId !== selectedPersona?.id) { setLoading(false); setRefreshing(false); return; }
      setData(res.data); setLastUpdated(new Date());
    } catch(e){
      const msg=String(e);
      setError(msg.includes("CORS")||msg.includes("fetch")||msg.includes("ERR_")?"__connection__":msg);
    } finally { setLoading(false); setRefreshing(false); loadingRef.current = false; }
  },[user,selectedPersona,dateRange]);

  useEffect(()=>{ load(); },[load]);

  // Re-fetch when Meta ad account changes (within same persona)
  useEffect(() => {
    const handler = () => { load(true); };
    window.addEventListener('meta-account-changed', handler);
    return () => window.removeEventListener('meta-account-changed', handler);
  }, [load]);

  const hasMeta=data?.meta&&!data.meta.error;

  const validMetrics = useMemo(()=>{
    const filtered = activeMetrics.filter(key=>{
      const def = METRICS.find(m=>m.key===key);
      return def && (def.platforms.includes("both") || def.platforms.includes(activePlatform));
    });
    if(filtered.length < 2) return ["spend","ctr"] as MetricKey[];
    return filtered;
  },[activeMetrics, activePlatform]);

  const d = hasMeta ? data.meta : (data?.combined || null);

  const dateLabel=useMemo(()=>{
    const diff=Math.round((dateRange.to.getTime()-dateRange.from.getTime())/86400000)+1;
    const preset=PRESETS.find(p=>p.days===diff&&fmt(dateRange.to)===fmt(today));
    if(preset) return `Últimos ${preset.label}`;
    return `${fmtLabel(dateRange.from)} → ${fmtLabel(dateRange.to)}`;
  },[dateRange,today]);

  const toggleSection = useCallback((s:SectionKey) => {
    setVisibleSections(prev => {
      const next = new Set(prev);
      if (next.has(s) && next.size > 1) next.delete(s); else next.add(s);
      return next;
    });
  }, []);

  const handleDragStart=(i:number)=>setDragging(i);
  const handleDragOver=(e:React.DragEvent,i:number)=>{ e.preventDefault(); setDragOver(i); };
  const handleDrop=(i:number)=>{
    if(dragging===null||dragging===i){ setDragging(null); setDragOver(null); return; }
    const next=[...activeMetrics]; const [moved]=next.splice(dragging,1); next.splice(i,0,moved);
    setActiveMetrics(next); setDragging(null); setDragOver(null);
  };

  return (
    <div style={{minHeight:"100%",background:BG,fontFamily:F,padding:"clamp(16px,4vw,28px) clamp(14px,4vw,28px) 100px"}} className="perf-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes ping{0%{transform:scale(1);opacity:1}75%{transform:scale(2);opacity:0}}
        .perf-card{animation:fadeIn 0.3s ease both;transition:transform 0.2s,box-shadow 0.2s}
        .perf-card:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(255,255,255,0.04)!important}
        .perf-card:hover .spark-card{border-color:rgba(255,255,255,0.12)!important}
        .drag-over .spark-card{border-color:rgba(255,255,255,0.18)!important;background:rgba(255,255,255,0.03)!important}
        .spark-card{transition:border-color 0.2s,box-shadow 0.2s}
        @media(max-width:768px){
          .perf-page{padding:14px 14px 80px!important}
          .perf-header-actions{gap:6px!important}
          .perf-metrics-grid{grid-template-columns:repeat(2,1fr)!important;gap:8px!important}
          .perf-header{flex-direction:column!important;align-items:flex-start!important;gap:10px!important}
          .perf-trend-chart{height:200px!important}
          .perf-ads-cols{display:none!important}
        }
        @media(max-width:480px){
          .perf-page{padding:10px 10px 80px!important}
          .perf-metrics-grid{grid-template-columns:1fr 1fr!important;gap:6px!important}
          .perf-trend-chart{height:160px!important}
        }
        @media(max-width:360px){
          .perf-metrics-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* ── Header ── */}
      <div className="perf-header" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:14}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <h1 style={{margin:0,fontSize:22,fontWeight:800,color:TX,letterSpacing:"-0.03em"}}>{selectedPersona?.name||"Performance"}</h1>
            {hasMeta&&!loading&&(
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)"}}>
                <MetaLogo size={13}/>
                <span style={{width:5,height:5,borderRadius:"50%",background:GREEN,boxShadow:`0 0 6px ${GREEN}`}}/>
                <span style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.50)",fontFamily:MONO,letterSpacing:"0.05em"}}>LIVE</span>
              </div>
            )}
          </div>
          {lastUpdated&&<p style={{margin:0,fontSize:11,color:MT,fontFamily:MONO}}>{lastUpdated.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</p>}

        </div>

        {/* Right side controls */}
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}} className="perf-header-actions">
            {/* Date picker */}
            <div style={{position:"relative"}}>
              <button onClick={()=>{setShowCalendar(!showCalendar);setShowCustomizer(false);}}
                style={{display:"flex",alignItems:"center",gap:7,padding:"7px 14px",background:showCalendar?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)",border:`1px solid ${showCalendar?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.07)"}`,borderRadius:8,color:showCalendar?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.55)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:MONO,transition:"all 0.15s"}}>
                <Calendar size={13} color={showCalendar?A:undefined}/>{dateLabel}
              </button>
              {showCalendar&&<CalendarPicker value={dateRange} onChange={r=>{setDateRange(r);}} onClose={()=>setShowCalendar(false)}/>}
            </div>

            {/* Metric customizer */}
            <div style={{position:"relative"}}>
              <button onClick={()=>{setShowCustomizer(!showCustomizer);setShowCalendar(false);}}
                style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:showCustomizer?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)",border:`1px solid ${showCustomizer?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.07)"}`,borderRadius:8,color:showCustomizer?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.50)",fontSize:13,cursor:"pointer",fontFamily:F,transition:"all 0.15s"}}>
                <Settings2 size={13} color={showCustomizer?A:undefined}/>
                <span style={{fontWeight:600,fontSize:12}}>Métricas</span>
                <span style={{fontSize:11,background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.55)",borderRadius:5,padding:"1px 6px",fontWeight:700,fontFamily:MONO}}>{activeMetrics.length}</span>
              </button>
              {showCustomizer&&<MetricCustomizer active={activeMetrics} platform={activePlatform} onChange={setActiveMetrics} onClose={()=>setShowCustomizer(false)}/>}
            </div>

            {/* Refresh */}
            <button onClick={()=>load(true)} style={{display:"flex",alignItems:"center",padding:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,color:"rgba(255,255,255,0.45)",cursor:"pointer",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(255,255,255,0.70)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.color="rgba(255,255,255,0.45)";}}>
              <RefreshCw size={13} color={refreshing?A:undefined} style={{animation:refreshing?"spin 1s linear infinite":"none"}}/>
            </button>
          </div>
      </div>

      {/* ── Empty: no persona ── */}
      {!selectedPersona&&!loading&&(
        <div style={{textAlign:"center",padding:"64px 24px",maxWidth:480,margin:"0 auto"}}>
          <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="3" height="18" rx="1"/><rect x="10.5" y="8" width="3" height="13" rx="1"/><rect x="3" y="13" width="3" height="8" rx="1"/></svg>
          </div>
          <h3 style={{color:TX,fontSize:17,fontWeight:700,margin:"0 0 8px",letterSpacing:"-0.02em"}}>
            {lang==="pt"?"Selecione uma conta para começar":lang==="es"?"Selecciona una cuenta":"Select an account"}
          </h3>
          <p style={{color:MT,fontSize:13,margin:"0 0 24px",lineHeight:1.65}}>
            {lang==="pt"?"Conecte Meta Ads e veja CTR, spend e ROAS em tempo real.":lang==="es"?"Conecta Meta Ads y ve tus métricas.":"Connect Meta Ads to see real-time metrics."}
          </p>
          <button onClick={()=>navigate("/dashboard/accounts")} style={{padding:"10px 22px",background:A,color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:F,transition:"opacity 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.opacity="0.85"}}
            onMouseLeave={e=>{e.currentTarget.style.opacity="1"}}>
            {lang==="pt"?"Conectar conta →":lang==="es"?"Conectar cuenta →":"Connect account →"}
          </button>
          <div style={{marginTop:32,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[
              {label:lang==="pt"?"CTR médio BR":"Avg CTR",value:"1.2–2.4%",sub:"Meta Ads"},
              {label:"ROAS",value:"2.5–4×",sub:"e-commerce"},
              {label:lang==="pt"?"Freq. limite":"Freq. limit",value:"2.5/sem",sub:"cold audience"},
            ].map(b=>(
              <div key={b.label} style={{background:`${A}05`,border:`1px solid ${A}10`,borderRadius:10,padding:12}}>
                <div style={{fontSize:18,fontWeight:800,color:TX,fontFamily:MONO,letterSpacing:"-0.02em",lineHeight:1,marginBottom:4}}>{b.value}</div>
                <div style={{fontSize:11,color:MT,fontWeight:500}}>{b.label}</div>
                <div style={{fontSize:10,color:`${A}40`,marginTop:2}}>{b.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Error: connection ── */}
      {error==="__connection__"&&!loading&&(
        <div style={{textAlign:"center",padding:"64px 24px",maxWidth:420,margin:"0 auto"}}>
          <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,255,255,0.03)",border:`1px solid ${A}15`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={A} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          </div>
          <h3 style={{color:TX,fontSize:17,fontWeight:700,margin:"0 0 8px"}}>
            {lang==="pt"?"Sem conexão com a conta":"No account connection"}
          </h3>
          <p style={{color:MT,fontSize:13,margin:"0 0 24px",lineHeight:1.65}}>
            {lang==="pt"?"Conecte Meta Ads para ver seus dados.":"Connect Meta Ads to see your data."}
          </p>
          <button onClick={()=>navigate("/dashboard/accounts")} style={{padding:"10px 22px",background:A,color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer"}}>
            {lang==="pt"?"Conectar conta →":"Connect account →"}
          </button>
        </div>
      )}

      {/* ── Error: generic ── */}
      {error&&error!=="__connection__"&&!loading&&(
        <div style={{display:"flex",gap:10,padding:16,background:`${RED}10`,border:`1px solid ${RED}25`,borderRadius:12,marginBottom:24}}>
          <AlertCircle size={16} color={RED} style={{flexShrink:0,marginTop:1}}/>
          <p style={{margin:0,fontSize:13,color:"#f87171"}}>{error}</p>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:20}}>
            {[...Array(6)].map((_,i)=>(
              <div key={i} style={{height:130,background:`${A}04`,borderRadius:14,border:`1px solid ${A}08`,opacity:1-i*0.08,animation:"fadeIn 0.25s ease both"}}/>
            ))}
          </div>
          <div style={{height:260,background:`${A}04`,borderRadius:14,border:`1px solid ${A}08`}}/>
        </div>
      )}

      {/* ── Platform error ── */}
      {!loading&&data?.meta?.error&&(
        <div style={{display:"flex",gap:8,padding:"8px 12px",background:`${AMBER}10`,border:`1px solid ${AMBER}25`,borderRadius:10,marginBottom:16}}>
          <AlertCircle size={14} color={AMBER} style={{flexShrink:0,marginTop:1}}/>
          <p style={{margin:0,fontSize:13,color:AMBER}}><strong>Meta</strong> — {data.meta.error}</p>
        </div>
      )}

      {/* ── Section filter chips ── */}
      {!loading&&d&&(
        <div style={{display:"inline-flex",gap:1,marginBottom:20,background:"rgba(255,255,255,0.04)",borderRadius:8,padding:2,border:"1px solid rgba(255,255,255,0.06)"}}>
          {SECTION_DEFS.map(s=>{
            const isActive=visibleSections.has(s.key);
            return (
              <button key={s.key} onClick={()=>toggleSection(s.key)}
                style={{
                  padding:"5px 16px",borderRadius:6,cursor:"pointer",
                  fontFamily:F,fontSize:12,fontWeight:isActive?600:500,
                  background:isActive?"rgba(255,255,255,0.08)":"transparent",
                  border:"none",
                  color:isActive?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.40)",
                  transition:"all 0.15s",letterSpacing:"-0.01em",
                }}>
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Data sections ── */}
      {!loading&&d&&(
        <>
          {/* Metric cards */}
          {visibleSections.has("cards")&&(
            <div className="perf-metrics-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",gap:12,marginBottom:28}}>
              {validMetrics.map((key,i)=>{
                const def=METRICS.find(m=>m.key===key);
                if(!def) return null;
                const value=getMetricValue(d,key);
                const daily=d.daily||[];
                const sparklineData = daily.map((day:any)=>({
                  x: fmtLabel(new Date(day.date+"T12:00:00")),
                  y: getMetricValue(day,key),
                }));

                return (
                  <div key={key} draggable
                    onDragStart={()=>handleDragStart(i)}
                    onDragOver={e=>handleDragOver(e,i)}
                    onDrop={()=>handleDrop(i)}
                    onDragEnd={()=>{setDragging(null);setDragOver(null);}}
                    className={`perf-card${dragOver===i&&dragging!==i?" drag-over":""}`}
                    style={{}}>
                    <SparklineCard
                      label={def.labelPt}
                      currentValue={value}
                      data={sparklineData}
                      format={FORMAT_MAP[key]}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Trend chart */}
          {visibleSections.has("trend")&&(d.daily||[]).length>1&&(
            <Reveal>
              <div style={{
                background:"rgba(255,255,255,0.02)",
                border:"1px solid rgba(255,255,255,0.06)",
                borderRadius:14,padding:"20px 24px",marginBottom:28,overflow:"hidden",
                position:"relative",
              }}>
                <div style={{position:"absolute",top:0,left:"5%",right:"5%",height:1,background:`linear-gradient(90deg, transparent, ${A}25, transparent)`}}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:3,height:16,borderRadius:2,background:A}}/>
                    <p style={{margin:0,fontSize:14,fontWeight:700,color:TX,letterSpacing:"-0.01em"}}>
                      Tendência — {dateLabel}
                    </p>
                  </div>
                  <div style={{display:"flex",gap:14}}>
                    {[{label:"CTR",color:A},{label:"Spend",color:AMBER}].map(l=>(
                      <div key={l.label} style={{display:"flex",alignItems:"center",gap:5}}>
                        <div style={{width:12,height:2,borderRadius:1,background:l.color}}/>
                        <span style={{fontSize:10,fontWeight:600,color:MT,letterSpacing:"0.05em",textTransform:"uppercase" as const,fontFamily:MONO}}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="perf-trend-chart" style={{height:260}}>
                  <ResponsiveLine
                    data={[
                      {
                        id:"CTR (%)",
                        data:(d.daily||[]).map((day:any)=>({
                          x:fmtLabel(new Date(day.date+"T12:00:00")),
                          y:+((day.ctr||0)*100).toFixed(2)
                        }))
                      },
                      {
                        id:"Spend (R$)",
                        data:(d.daily||[]).map((day:any)=>({
                          x:fmtLabel(new Date(day.date+"T12:00:00")),
                          y:+(day.spend||0).toFixed(0)
                        }))
                      }
                    ]}
                    theme={TK.nivoTheme}
                    colors={[A,AMBER]}
                    margin={{top:12,right:12,bottom:36,left:52}}
                    xScale={{type:"point"}}
                    yScale={{type:"linear",min:"auto",max:"auto"}}
                    axisBottom={{tickRotation:-45,tickPadding:8,tickSize:0}}
                    axisLeft={{tickSize:0,tickPadding:8}}
                    enableGridX={false}
                    enableGridY={true}
                    lineWidth={2}
                    enablePoints={true}
                    pointSize={4}
                    pointColor={{theme:"background"}}
                    pointBorderWidth={2}
                    pointBorderColor={{from:"serieColor"}}
                    enableCrosshair={true}
                    useMesh={true}
                    curve="monotoneX"
                    enableArea
                    areaOpacity={0.06}
                  />
                </div>
              </div>
            </Reveal>
          )}

        </>
      )}

    </div>
  );
}
