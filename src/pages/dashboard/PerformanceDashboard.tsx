import { storage } from "@/lib/storage";
// PerformanceDashboard v4 — New UI components with SparklineCard, visualizations, and Nivo charts
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw, DollarSign, MousePointer, Target, Eye, Zap, Rocket,
  ArrowUpRight, AlertCircle, ChevronLeft, ChevronRight,
  Settings2, GripVertical, X, Calendar, Check, TrendingUp, TrendingDown,
  BarChart3, Activity, Users, Repeat
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import AdDiary from "./AdDiary";
import { SparklineCard } from "@/components/ui/SparklineCard";
import { HeatmapPerformance } from "@/components/ui/HeatmapPerformance";
import { WinnersList } from "@/components/ui/WinnersList";
import { FatigueRadar } from "@/components/ui/FatigueRadar";
import { CreativeRaceBar } from "@/components/ui/CreativeRaceBar";
import { Reveal } from "@/components/ui/Reveal";
import { ResponsiveLine } from "@nivo/line";
import { ADBRIEF_TOKENS as TK } from "@/styles/tokens";

// ── Constants ─────────────────────────────────────────────────────────────────
const F = "'DM Sans','Plus Jakarta Sans',system-ui,sans-serif";
const BG = "var(--bg-main)", S1 = "var(--bg-card)", S2 = "var(--bg-surface)", BD = "var(--border-subtle)";
const TX = "var(--text-primary)", MT = "var(--text-muted)", ACCENT = "#0ea5e9";
const GREEN = "#22c55e", RED = "#ef4444", AMBER = "#f59e0b", GBLUE = "#4285F4";

// ── All available metrics ─────────────────────────────────────────────────────
type MetricKey = "spend"|"ctr"|"clicks"|"impressions"|"conversions"|"roas"|"cpa"|"cpm"|"cpc"|"reach"|"frequency"|"conv_value";

interface MetricDef {
  key: MetricKey; label: string; labelPt: string; labelEs: string;
  icon: any; accent: string; format: (v: number, lang?: string) => string;
  higherIsBetter: boolean; platforms: ("meta"|"both")[];
}

const METRICS: MetricDef[] = [
  { key:"spend",       label:"Ad Spend",    labelPt:"Gasto",        labelEs:"Gasto",        icon:DollarSign,  accent:ACCENT,    format:(v,lang)=>{ const sym=lang==="pt"?"R$":"$"; if(v>=1000000)return sym+(v/1000000).toFixed(1)+"M"; if(v>=1000)return sym+(v/1000).toFixed(1)+"k"; return sym+v.toFixed(0); },    higherIsBetter:false, platforms:["both"]   },
  { key:"ctr",         label:"CTR",         labelPt:"CTR",          labelEs:"CTR",          icon:MousePointer,accent:GREEN,     format:(v)=>`${(v*100).toFixed(2)}%`,                                higherIsBetter:true,  platforms:["both"]   },
  { key:"clicks",      label:"Clicks",      labelPt:"Cliques",      labelEs:"Clics",        icon:Target,      accent:"#a78bfa", format:(v)=>v>=1000?(v/1000).toFixed(1)+"k":String(Math.round(v)), higherIsBetter:true,  platforms:["both"]   },
  { key:"impressions", label:"Impressions", labelPt:"Impressões",   labelEs:"Impresiones",  icon:Eye,         accent:"#f97316", format:(v)=>{ if(v>=1000000)return (v/1000000).toFixed(1)+"M"; if(v>=1000)return (v/1000).toFixed(0)+"k"; return String(Math.round(v)); }, higherIsBetter:true,  platforms:["both"]   },
  { key:"conversions", label:"Conversions", labelPt:"Conversões",   labelEs:"Conversiones", icon:TrendingUp,  accent:AMBER,     format:(v)=>String(Math.round(v)),                                   higherIsBetter:true,  platforms:["both"]   },
  { key:"roas",        label:"ROAS",        labelPt:"ROAS",         labelEs:"ROAS",         icon:BarChart3,   accent:GREEN,     format:(v)=>`${v.toFixed(2)}×`,                                      higherIsBetter:true,  platforms:["both"]   },
  { key:"cpa",         label:"CPA",         labelPt:"CPA",          labelEs:"CPA",          icon:Activity,    accent:"#f43f5e", format:(v,lang)=>{ const sym=lang==="pt"?"R$":"$"; if(v>=1000)return sym+(v/1000).toFixed(1)+"k"; return sym+v.toFixed(0); },                                      higherIsBetter:false, platforms:["both"]   },
  { key:"cpm",         label:"CPM",         labelPt:"CPM",          labelEs:"CPM",          icon:Users,       accent:"#06b6d4", format:(v,lang)=>(lang==="pt"?"R$":"$")+v.toFixed(2),                                      higherIsBetter:false, platforms:["meta"]   },
  { key:"cpc",         label:"CPC",         labelPt:"CPC",          labelEs:"CPC",          icon:Repeat,      accent:"#8b5cf6", format:(v,lang)=>(lang==="pt"?"R$":"$")+v.toFixed(2),                                      higherIsBetter:false, platforms:["both"]   },
  { key:"reach",       label:"Reach",       labelPt:"Alcance",      labelEs:"Alcance",      icon:Users,       accent:"#14b8a6", format:(v)=>{ if(v>=1000000)return (v/1000000).toFixed(1)+"M"; if(v>=1000)return (v/1000).toFixed(0)+"k"; return String(Math.round(v)); }, higherIsBetter:true,  platforms:["meta"]   },
  { key:"frequency",   label:"Frequency",   labelPt:"Frequência",   labelEs:"Frecuencia",   icon:Repeat,      accent:AMBER,     format:(v)=>v.toFixed(2),                                            higherIsBetter:false, platforms:["meta"]   },
  { key:"conv_value",  label:"Conv. Value", labelPt:"Valor Conv.",  labelEs:"Valor Conv.",  icon:DollarSign,  accent:GREEN,     format:(v,lang)=>{ const sym=lang==="pt"?"R$":"$"; if(v>=1000000)return sym+(v/1000000).toFixed(1)+"M"; if(v>=1000)return sym+(v/1000).toFixed(1)+"k"; return sym+v.toFixed(0); },    higherIsBetter:true,  platforms:["both"]   },
];

const DEFAULT_METRICS: MetricKey[] = ["spend","ctr","clicks","roas","conversions","cpa"];

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

// ── Mock data generators — replace with real data from live-metrics edge function ──
function generateMockHeatmapData() {
  const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return DAYS.map(day => ({
    id: day,
    data: Array.from({ length: 12 }, (_, i) => ({
      x: `${i * 2}h`,
      y: +(Math.random() * 3 + 0.5).toFixed(2),
    })),
  }));
}

function generateMockWinners(): Array<{ name: string; ctr: number; roas: number; spend: number; trend: "up" | "down" | "hot" | "risk"; contribution: number }> {
  return [
    { name: "Carrossel_Oferta_V3", ctr: 0.042, roas: 4.2, spend: 1240, trend: "hot", contribution: 28 },
    { name: "Video_Hook_Direto", ctr: 0.038, roas: 3.8, spend: 980, trend: "up", contribution: 22 },
    { name: "Static_Desconto_40", ctr: 0.031, roas: 3.1, spend: 760, trend: "up", contribution: 17 },
    { name: "UGC_Depoimento_Maria", ctr: 0.027, roas: 2.4, spend: 620, trend: "down", contribution: 14 },
    { name: "Reels_Bastidores", ctr: 0.019, roas: 1.6, spend: 440, trend: "risk", contribution: 10 },
  ];
}

function generateMockLosers(): Array<{ name: string; ctr: number; roas: number; spend: number; trend: "up" | "down" | "hot" | "risk"; contribution: number }> {
  return [
    { name: "Banner_Generico_V1", ctr: 0.008, roas: 0.4, spend: 320, trend: "risk", contribution: 7 },
    { name: "Copy_Longa_V2", ctr: 0.011, roas: 0.7, spend: 280, trend: "down", contribution: 6 },
    { name: "Imagem_Stock_05", ctr: 0.006, roas: 0.2, spend: 200, trend: "risk", contribution: 5 },
  ];
}

function generateMockBumpData() {
  const creatives = ["Carrossel_V3", "Video_Hook", "Static_40", "UGC_Maria", "Reels_BTS"];
  const periods = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
  // Bump chart requires each rank to appear exactly once per period
  return creatives.map((id, ci) => ({
    id,
    data: periods.map((x, pi) => {
      // Deterministic but varied ranking per period
      const rank = ((ci + pi) % creatives.length) + 1;
      return { x, y: rank };
    }),
  }));
}

// ── Gradient separator ────────────────────────────────────────────────────────
function GradientSep() {
  return (
    <div style={{
      height: 1,
      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07) 20%, rgba(255,255,255,0.07) 80%, transparent)",
      margin: "20px 0",
    }} />
  );
}

// ── Live pulse dot ───────────────────────────────────────────────────────────
function LiveDot() {
  return (
    <div style={{ position: "relative", width: 8, height: 8, display: "inline-flex" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
      <div style={{
        position: "absolute", inset: -3,
        borderRadius: "50%", border: "1px solid #10b981",
        animation: "ping 1.5s ease-out infinite",
        opacity: 0.6,
      }} />
    </div>
  );
}

// ── Calendar Date Picker ──────────────────────────────────────────────────────
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
            <div key={i} style={{textAlign:"center",fontSize: 12,fontWeight:600,color:MT,padding:"4px 0",fontFamily:F}}>{d}</div>
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
                  background:isE?ACCENT:inR?`${ACCENT}22`:"transparent",
                  color:isE?"#fff":isFuture?"rgba(255,255,255,0.15)":inR?ACCENT:TX,
                  transition:"all 0.1s",
                }}>{d.getDate()}</div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div ref={ref} style={{
      position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:999,
      background:"var(--bg-elevated)",border:"1px solid var(--border-default)",borderRadius:16,
      boxShadow:"0 20px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.04)",
      padding:"clamp(12px,3vw,20px)",
      width:"min(560px, calc(100vw - 24px))",
      maxWidth:"calc(100vw - 24px)",
      display:"flex",flexDirection:"column",gap:16,
    }}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
        {PRESETS.map(p=>{
          const from=addDays(today,-p.days+1);
          const active=fmt(value.from)===fmt(from)&&fmt(value.to)===fmt(today);
          return (
            <button key={p.days} onClick={()=>{onChange({from,to:today});onClose();}}
              style={{fontFamily:F,fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:8,border:`1px solid ${active?ACCENT:BD}`,background:active?`${ACCENT}18`:"transparent",color:active?ACCENT:MT,cursor:"pointer",transition:"all 0.15s"}}>
              Últimos {p.label}
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
        {draft.from&&<span style={{fontFamily:F,fontSize:12,color:TX,fontWeight:600}}>{fmtLabel(draft.from)} {draft.to?`→ ${fmtLabel(draft.to)}`:"→ ..."}</span>}
      </div>
    </div>
  );
}

// ── Metric Customizer ─────────────────────────────────────────────────────────
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
    <div ref={ref} style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:999,background:"var(--bg-elevated)",border:"1px solid var(--border-default)",borderRadius:16,boxShadow:"0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",padding:20,width:300}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <span style={{fontFamily:F,fontSize:14,fontWeight:700,color:TX}}>Personalizar métricas</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:MT,cursor:"pointer",display:"flex"}}><X size={14}/></button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {available.map(m=>{
          const Icon=m.icon; const isActive=active.includes(m.key);
          return (
            <button key={m.key} onClick={()=>toggle(m.key)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,border:`1px solid ${isActive?m.accent+"40":BD}`,background:isActive?`${m.accent}10`:"transparent",cursor:"pointer",textAlign:"left",width:"100%",transition:"all 0.15s"}}>
              <div style={{width:26,height:26,borderRadius:8,background:isActive?`${m.accent}20`:S2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Icon size={12} color={isActive?m.accent:MT}/>
              </div>
              <span style={{flex:1,fontFamily:F,fontSize:13,fontWeight:isActive?600:400,color:isActive?TX:MT}}>{m.labelPt}</span>
              <div style={{width:17,height:17,borderRadius:"50%",border:`1.5px solid ${isActive?m.accent:BD}`,background:isActive?m.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {isActive&&<Check size={9} color="#fff" strokeWidth={3}/>}
              </div>
            </button>
          );
        })}
      </div>
      <p style={{fontFamily:F,fontSize: 12,color:MT,marginTop:10,textAlign:"center"}}>{active.length}/{available.length} ativas · arraste cards para reordenar</p>
    </div>
  );
}


// ── Ad Row ────────────────────────────────────────────────────────────────────
// ── Ads list with compact/expand ─────────────────────────────────────────────
const AdsCompact = React.memo(function AdsCompact({ ads }: { ads: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 5;
  const visible = expanded ? ads : ads.slice(0, LIMIT);
  const extra = ads.length - LIMIT;
  return (
    <div style={{paddingBottom:8}}>
      {visible.map((ad:any,i:number)=><AdRow key={ad.id||i} ad={ad} rank={i+1}/>)}
      {ads.length > LIMIT && (
        <button onClick={()=>setExpanded(e=>!e)} style={{marginTop:10,width:"100%",padding:"8px 0",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(255,255,255,0.07)`,borderRadius:8,color:"rgba(255,255,255,0.4)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}
          onMouseEnter={e=>(e.currentTarget.style.color="rgba(255,255,255,0.7)")}
          onMouseLeave={e=>(e.currentTarget.style.color="rgba(255,255,255,0.4)")}>
          {expanded ? "▲ Mostrar menos" : `▼ Ver mais ${extra} anúncio${extra>1?"s":""}`}
        </button>
      )}
    </div>
  );
});

// Column widths — must match header exactly
const COL={spend:70,ctr:70,roas:70,status:90};

const AdRow = React.memo(function AdRow({ ad, rank }: { ad:any; rank:number }) {
  const ctr=(ad.ctr||0)*100;
  const isWinner=ctr>2||(ad.roas&&ad.roas>2);
  const isPauser=ctr<0.3&&ad.spend>20;
  const isMeta=ad.platform==="meta";
  return (
    <div style={{display:"flex",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${BD}`,gap:0}}>
      <span style={{width:28,fontSize:12,color:MT,fontWeight:600,flexShrink:0}}>{rank}</span>
      <div style={{flex:1,minWidth:0,paddingRight:16}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <p style={{margin:0,fontSize:13,fontWeight:500,color:TX,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ad.name||"—"}</p>
          <span style={{fontSize:11,fontWeight:700,padding:"1px 6px",borderRadius:4,background:isMeta?"rgba(14,165,233,0.1)":"rgba(66,133,244,0.1)",border:`1px solid ${isMeta?"rgba(14,165,233,0.2)":"rgba(66,133,244,0.2)"}`,color:isMeta?ACCENT:GBLUE,flexShrink:0,whiteSpace:"nowrap"}}>
            {isMeta?"Meta":"Google"}
          </span>
        </div>
        {ad.campaign&&ad.campaign!==ad.name&&<p style={{margin:"2px 0 0",fontSize:11,color:MT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ad.campaign}</p>}
      </div>
      {/* Fixed-width columns — must align with header */}
      <div style={{width:COL.spend,textAlign:"right",flexShrink:0}}>
        <p style={{margin:0,fontSize:13,fontWeight:700,color:TX}}>R${(ad.spend||0).toFixed(0)}</p>
      </div>
      <div style={{width:COL.ctr,textAlign:"right",flexShrink:0}}>
        <p style={{margin:0,fontSize:13,fontWeight:700,color:ctr>2?GREEN:ctr<0.5?RED:TX}}>{ctr.toFixed(2)}%</p>
      </div>
      <div style={{width:COL.roas,textAlign:"right",flexShrink:0}}>
        {ad.roas!=null?<p style={{margin:0,fontSize:13,fontWeight:700,color:ad.roas>2?GREEN:TX}}>{ad.roas.toFixed(1)}×</p>:<p style={{margin:0,fontSize:13,color:MT}}>—</p>}
      </div>
      <div style={{width:COL.status,textAlign:"right",flexShrink:0}}>
        {isWinner&&<span style={{fontSize:12,fontWeight:700,color:GREEN,background:"rgba(34,197,94,0.1)",borderRadius:6,padding:"3px 8px"}}>↑ Escalar</span>}
        {isPauser&&<span style={{fontSize:12,fontWeight:700,color:RED,background:"rgba(239,68,68,0.1)",borderRadius:6,padding:"3px 8px"}}> Pausar</span>}
        {!isWinner&&!isPauser&&<span style={{fontSize:12,color:MT}}>—</span>}
      </div>
    </div>
  );
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PerformanceDashboard() {
  usePageTitle("Performance");
  const {user,selectedPersona} = useOutletContext<DashboardContext>();
  const {language} = useLanguage();
  const navigate = useNavigate();
  const lang = language as "pt"|"es"|"en";

  const today = useMemo(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; },[]);
  const [dateRange, setDateRange] = useState<DateRange>({from:addDays(today,-6),to:today});
  const [showCalendar, setShowCalendar] = useState(false);
  const [activePlatform, setActivePlatform] = useState<"meta">("meta");
  const [activeTab, setActiveTab] = useState<"metrics"|"ads">("metrics");
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(()=>storage.getJSON("adbrief_perf_metrics", DEFAULT_METRICS));
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [chartMetric, setChartMetric] = useState<MetricKey>("spend");
  const [dragging, setDragging] = useState<number|null>(null);
  const [dragOver, setDragOver] = useState<number|null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date|null>(null);

  useEffect(()=>{ storage.setJSON("adbrief_perf_metrics", activeMetrics); },[activeMetrics]);

  const load = useCallback(async(showSpinner=false)=>{
    if(!user||!selectedPersona) { setLoading(false); return; }
    if(showSpinner) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const days=Math.round((dateRange.to.getTime()-dateRange.from.getTime())/86400000)+1;
      const period=days<=7?"7d":days<=14?"14d":days<=30?"30d":days<=60?"60d":"90d";
      const res=await supabase.functions.invoke("live-metrics",{body:{user_id:user.id,persona_id:selectedPersona.id,period,date_from:fmt(dateRange.from),date_to:fmt(dateRange.to)}});
      if(res.error) throw new Error(res.error.message);
      setData(res.data); setLastUpdated(new Date());
    } catch(e){
      const msg=String(e);
      setError(msg.includes("CORS")||msg.includes("fetch")||msg.includes("ERR_")?"__connection__":msg);
    } finally { setLoading(false); setRefreshing(false); }
  },[user,selectedPersona,dateRange]);

  useEffect(()=>{ load(); },[load]);

  const hasMeta=data?.meta&&!data.meta.error;
  const hasGoogle=false; // disabled

  useEffect(()=>{ if(data){ if(hasMeta) setActivePlatform("meta"); } },[data,hasMeta]);

  // Filter active metrics to only those valid for current platform
  const validMetrics = useMemo(()=>{
    const filtered = activeMetrics.filter(key=>{
      const def = METRICS.find(m=>m.key===key);
      return def && (def.platforms.includes("both") || def.platforms.includes(activePlatform));
    });
    // Ensure at least spend + ctr always shown
    if(filtered.length < 2) return ["spend","ctr"] as MetricKey[];
    return filtered;
  },[activeMetrics, activePlatform]);

  const d = hasMeta ? data.meta : (data?.combined || null);

  const sparkData = useMemo(()=>{
    const daily=d?.daily||[];
    const result:Partial<Record<MetricKey,number[]>>={};
    for(const m of validMetrics) result[m]=daily.map((day:any)=>getMetricValue(day,m));
    return result;
  },[d,activeMetrics]);

  const getMetricDelta=(key:MetricKey):number|null=>{
    if(!d) return null;
    const curr=getMetricValue(d,key);
    const prev=d[`prev_${key}`];
    if(prev===undefined||prev===null||prev===0) return null;
    return ((curr-prev)/prev)*100;
  };

  const dateLabel=useMemo(()=>{
    const diff=Math.round((dateRange.to.getTime()-dateRange.from.getTime())/86400000)+1;
    const preset=PRESETS.find(p=>p.days===diff&&fmt(dateRange.to)===fmt(today));
    if(preset) return `Últimos ${preset.label}`;
    return `${fmtLabel(dateRange.from)} → ${fmtLabel(dateRange.to)}`;
  },[dateRange,today]);

  // Memoize mock data to avoid re-generating on every render
  const mockWinners = useMemo(() => generateMockWinners(), []);
  const mockHeatmap = useMemo(() => generateMockHeatmapData(), []);
  const mockBump = useMemo(() => generateMockBumpData(), []);

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
        @keyframes shimmer{0%{background-position:200% 0}to{background-position:-200% 0}}
        .perf-card{animation:fadeIn 0.3s ease both;transition:transform 0.15s,box-shadow 0.15s,border-color 0.15s}
        .perf-card:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.06)!important;}
        .drag-over{border-color:${ACCENT}60!important;background:${ACCENT}08!important}
        @media(max-width:768px){
          .perf-page{padding:14px 14px 80px!important}
          .perf-header-actions{gap:6px!important;flex-wrap:wrap!important}
          .perf-platform-tabs button{padding:5px 10px!important;font-size:12px!important}
          .perf-action-btn{padding:6px 10px!important;font-size:12px!important}
          /* Metric cards: 2 por linha */
          .perf-metrics-grid{grid-template-columns:repeat(2,1fr)!important;gap:8px!important}
          /* Header: empilha verticalmente */
          .perf-header{flex-direction:column!important;align-items:flex-start!important;gap:12px!important}
          /* Calendar: esconde texto do presets */
          .perf-preset-label{display:none!important}
          /* Tabs: menores */
          .perf-tabs button{padding:5px 14px!important;font-size:12px!important}
        }
        @media(max-width:480px){
          .perf-page{padding:12px 12px 80px!important}
          .perf-metrics-grid{grid-template-columns:repeat(2,1fr)!important;gap:6px!important}
          .perf-new-btn span{display:none}
          .perf-action-btn span{display:none}
        }
      `}</style>

      {/* Header + Tabs */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:14}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <h1 style={{margin:0,fontSize:22,fontWeight:700,color:TX,letterSpacing:"-0.03em"}}>{selectedPersona?.name||"Performance"}</h1>
            {activeTab==="metrics"&&hasMeta&&!loading&&(
              <span style={{display:"flex",alignItems:"center",gap:5,fontSize: 12,fontWeight:700,color:GREEN,background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:20,padding:"3px 10px"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:GREEN,boxShadow:"0 0 6px #22c55e"}}/>LIVE
              </span>
            )}
          </div>
          {activeTab==="metrics"&&lastUpdated&&<p style={{margin:0,fontSize: 12,color:MT}}>Atualizado {lastUpdated.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</p>}
          {/* Tabs */}
          <div style={{display:"flex",gap:2,marginTop:12,background:"var(--bg-surface)",border:"1px solid var(--border-subtle)",borderRadius:10,padding:3,width:"fit-content"}}>
            {([["metrics",language==="pt"?"Métricas":language==="es"?"Métricas":"Metrics"],["ads",language==="pt"?"Ads":"Ads"]] as const).map(([tab,label])=>(
              <button key={tab} onClick={()=>setActiveTab(tab)}
                style={{padding:"6px 18px",borderRadius:7,cursor:"pointer",
                  fontFamily:"'Plus Jakarta Sans', sans-serif",fontSize:13,fontWeight:activeTab===tab?700:500,
                  background:activeTab===tab?"linear-gradient(135deg,rgba(14,165,233,0.20),rgba(6,182,212,0.12))":"transparent",
                  color:activeTab===tab?"#f0f2f8":"rgba(255,255,255,0.45)",
                  border:activeTab===tab?"1px solid rgba(14,165,233,0.28)":"1px solid transparent",
                  boxShadow:activeTab===tab?"0 2px 8px rgba(14,165,233,0.15)":"none",
                  transition:"all 0.15s"}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "metrics" && <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const,position:"relative"}} className="perf-header-actions">
          {/* Platform tabs */}
          <div className="perf-platform-tabs" style={{display:"flex",gap:2,background:"var(--bg-surface)",border:`1px solid var(--border-subtle)`,borderRadius:10,padding:3}}>
            {([["meta","Meta Ads",ACCENT]] as const).map(([plt,label,color])=>{
              const active=activePlatform===plt,hasData=hasMeta;
              return (
                <button key={plt} onClick={()=>hasData&&setActivePlatform(plt)}
                  style={{padding:"6px 14px",borderRadius:8,border:"none",cursor:hasData?"pointer":"default",fontFamily:F,fontSize:13,fontWeight:active?700:500,background:active&&hasData?S1:"transparent",color:active&&hasData?color:hasData?MT:"rgba(255,255,255,0.2)",transition:"all 0.15s",opacity:hasData?1:0.4}}>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Date picker */}
          <div style={{position:"relative"}}>
            <button onClick={()=>{setShowCalendar(!showCalendar);setShowCustomizer(false);}}
              style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",background:showCalendar?`${ACCENT}15`:"rgba(255,255,255,0.06)",border:`1px solid ${showCalendar?ACCENT+"50":BD}`,borderRadius:10,color:showCalendar?ACCENT:TX,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:F,transition:"all 0.15s"}}>
              <Calendar size={13}/>{dateLabel}
            </button>
            {showCalendar&&<CalendarPicker value={dateRange} onChange={r=>{setDateRange(r);}} onClose={()=>setShowCalendar(false)}/>}
          </div>

          {/* Metric customizer */}
          <div style={{position:"relative"}}>
            <button onClick={()=>{setShowCustomizer(!showCustomizer);setShowCalendar(false);}}
              style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:showCustomizer?`${ACCENT}15`:"rgba(255,255,255,0.06)",border:`1px solid ${showCustomizer?ACCENT+"50":BD}`,borderRadius:10,color:showCustomizer?ACCENT:MT,fontSize:13,cursor:"pointer",fontFamily:F,transition:"all 0.15s"}}>
              <Settings2 size={14}/>
              <span style={{fontWeight:600}}>Métricas</span>
              <span style={{fontSize: 12,background:`${ACCENT}20`,color:ACCENT,borderRadius:5,padding:"1px 6px",fontWeight:700}}>{activeMetrics.length}</span>
            </button>
            {showCustomizer&&<MetricCustomizer active={activeMetrics} platform={activePlatform} onChange={setActiveMetrics} onClose={()=>setShowCustomizer(false)}/>}
          </div>

          <button onClick={()=>load(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:"rgba(255,255,255,0.06)",border:`1px solid ${BD}`,borderRadius:10,color:MT,fontSize:13,cursor:"pointer",fontFamily:F}}>
            <RefreshCw size={13} style={{animation:refreshing?"spin 1s linear infinite":"none"}}/>
          </button>
          <button onClick={()=>navigate("/dashboard/campaigns/new")} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",background:"#0ea5e9",border:"none",borderRadius:10,color:"#000",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F}}>
            <Rocket size={13}/>{lang==="pt"?"Nova campanha":lang==="es"?"Nueva campaña":"New campaign"}
          </button>
        </div>}
      </div>

      {/* Empty states */}
      {activeTab==="metrics"&&!selectedPersona&&!loading&&(
        <div style={{textAlign:"center",padding:"64px 24px",maxWidth:480,margin:"0 auto"}}>
          {/* Clean icon — no emoji */}
          <div style={{width:48,height:48,borderRadius:14,background:"rgba(14,165,233,0.08)",border:"1px solid rgba(14,165,233,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(14,165,233,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="3" height="18" rx="1"/><rect x="10.5" y="8" width="3" height="13" rx="1"/><rect x="3" y="13" width="3" height="8" rx="1"/></svg>
          </div>
          <h3 style={{color:TX,fontSize:17,fontWeight:700,margin:"0 0 8px",letterSpacing:"-0.02em",fontFamily:F}}>
            {lang==="pt"?"Selecione uma conta para ver o painel":lang==="es"?"Selecciona una cuenta para ver el panel":"Select an account to view the dashboard"}
          </h3>
          <p style={{color:MT,fontSize:13,margin:"0 0 24px",lineHeight:1.65,fontFamily:F}}>
            {lang==="pt"?"Conecte Meta Ads e veja CTR, spend, ROAS e fadiga criativa em tempo real.":lang==="es"?"Conecta Meta Ads y ve CTR, spend, ROAS y fatiga creativa en tiempo real.":"Connect Meta Ads and see CTR, spend, ROAS and creative fatigue in real time."}
          </p>
          <button onClick={()=>navigate("/dashboard/accounts")} style={{padding:"10px 22px",background:ACCENT,color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:F,transition:"opacity 0.15s"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="0.85"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="1"}}>
            {lang==="pt"?"Conectar conta →":lang==="es"?"Conectar cuenta →":"Connect account →"}
          </button>
          {/* Benchmarks — value is primary, label is secondary */}
          <div style={{marginTop:32,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[
              {label:lang==="pt"?"CTR médio BR":lang==="es"?"CTR promedio":"Avg CTR",value:"1.2–2.4%",sub:"Meta Ads"},
              {label:"ROAS",value:"2.5–4×",sub:lang==="pt"?"e-commerce BR":"e-commerce"},
              {label:lang==="pt"?"Freq. limite":lang==="es"?"Frec. límite":"Freq. limit",value:"2.5/sem",sub:lang==="pt"?"cold audience":"cold audience"},
            ].map(b=>(
              <div key={b.label} style={{background:"var(--bg-surface)",border:"1px solid var(--border-subtle)",borderRadius:10,padding:"12px"}}>
                <div style={{fontSize:18,fontWeight:700,color:TX,fontFamily:F,letterSpacing:"-0.02em",lineHeight:1,marginBottom:4}}>{b.value}</div>
                <div style={{fontSize: 12,color:MT,fontFamily:F,fontWeight:500}}>{b.label}</div>
                <div style={{fontSize: 12,color:"rgba(255,255,255,0.2)",fontFamily:F,marginTop:2}}>{b.sub}</div>
              </div>
            ))}
          </div>
          <p style={{marginTop:12,fontSize: 12,color:"rgba(255,255,255,0.18)",fontFamily:F,lineHeight:1.5}}>
            {lang==="pt"?"Benchmarks médios do setor":lang==="es"?"Benchmarks del sector":"Industry average benchmarks"}
          </p>
        </div>
      )}
      {activeTab==="metrics"&&error==="__connection__"&&!loading&&(
        <div style={{textAlign:"center",padding:"64px 24px",maxWidth:420,margin:"0 auto"}}>
          <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          </div>
          <h3 style={{color:TX,fontSize:17,fontWeight:700,margin:"0 0 8px",letterSpacing:"-0.02em",fontFamily:F}}>
            {lang==="pt"?"Sem conexão com a conta":lang==="es"?"Sin conexión con la cuenta":"No account connection"}
          </h3>
          <p style={{color:MT,fontSize:13,margin:"0 0 24px",lineHeight:1.65,maxWidth:360,marginInline:"auto",fontFamily:F}}>
            {lang==="pt"?"Conecte Meta Ads para ver seus dados em tempo real.":lang==="es"?"Conecta Meta Ads para ver tus datos en tiempo real.":"Connect Meta Ads to see your data in real time."}
          </p>
          <button onClick={()=>navigate("/dashboard/accounts")} style={{padding:"10px 22px",background:ACCENT,color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:F,transition:"opacity 0.15s"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="0.85"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="1"}}>
            {lang==="pt"?"Conectar conta →":lang==="es"?"Conectar cuenta →":"Connect account →"}
          </button>
        </div>
      )}
      {activeTab==="metrics"&&error&&error!=="__connection__"&&!loading&&(
        <div style={{display:"flex",gap:10,padding:"16px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,marginBottom:24}}>
          <AlertCircle size={16} color={RED} style={{flexShrink:0,marginTop:1}}/>
          <p style={{margin:0,fontSize:13,color:"#f87171"}}>{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {activeTab==="metrics"&&loading&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:14}}>
            {[...Array(6)].map((_,i)=>(
              <div key={i} style={{height:110,background:"var(--bg-card)",borderRadius:16,border:"1px solid var(--border-subtle)",opacity:1-i*0.08,animation:"fadeIn 0.4s ease both",animationDelay:`${i*0.05}s`}}/>
            ))}
          </div>
          <div style={{height:220,background:"var(--bg-card)",borderRadius:16,border:"1px solid var(--border-subtle)"}}/>
        </div>
      )}

      {/* Platform error banners */}
      {activeTab==="metrics"&&!loading&&data&&(
        <>
          {data?.meta?.error&&<div style={{display:"flex",gap:8,padding:"8px 12px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,marginBottom:16}}><AlertCircle size={14} color={AMBER} style={{flexShrink:0,marginTop:1}}/><p style={{margin:0,fontSize:13,color:AMBER}}><strong style={{fontWeight:600}}>Meta Ads</strong> — {data.meta.error}</p></div>}
          {/* Google error banner — disabled */}
        </>
      )}

      {/* SparklineCard grid with new UI components */}
      {activeTab==="metrics"&&!loading&&d&&(
        <>
          {/* Sparkline Cards Grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:14,marginBottom:28,overflow:"visible"}}>
            {validMetrics.map((key,i)=>{
              const def=METRICS.find(m=>m.key===key);
              if(!def) return null;
              const value=getMetricValue(d,key);
              const prevValue=d[`prev_${key}`];
              const daily=d.daily||[];
              const sparklineData = daily.map((day:any)=>({
                x: fmtLabel(new Date(day.date+"T12:00:00")),
                y: getMetricValue(day,key),
              }));

              const formatMap: Record<MetricKey, "currency"|"percent"|"number"|"roas"> = {
                spend: "currency", ctr: "percent", clicks: "number", impressions: "number",
                conversions: "number", roas: "roas", cpa: "currency", cpm: "currency",
                cpc: "currency", reach: "number", frequency: "number", conv_value: "currency"
              };

              return (
                <Reveal key={key} delay={i*0.05}>
                  <div draggable
                    onDragStart={()=>handleDragStart(i)}
                    onDragOver={e=>handleDragOver(e,i)}
                    onDrop={()=>handleDrop(i)}
                    onDragEnd={()=>{setDragging(null);setDragOver(null);}}
                    className={`perf-card${dragOver===i&&dragging!==i?" drag-over":""}`}
                    style={{animationDelay:`${i*0.04}s`}}>
                    <SparklineCard
                      label={def.labelPt}
                      currentValue={value}
                      prevValue={prevValue}
                      data={sparklineData}
                      format={formatMap[key]}
                      color={def.accent}
                      index={i}
                    />
                  </div>
                </Reveal>
              );
            })}
          </div>

          <GradientSep />

          {/* 2-column grid: Nivo Line Chart + FatigueRadar */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))",gap:20,marginBottom:28}}>
            <Reveal direction="left">
              <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:16,padding:24,overflow:"hidden"}}>
                <p style={{margin:"0 0 16px",fontSize:13,fontWeight:700,color:TX}}>Tendência — CTR + ROAS (últimos 14 dias)</p>
                <div style={{height:280}}>
                  <ResponsiveLine
                    data={[
                      {
                        id:"CTR",
                        data:(d.daily||[]).slice(-14).map((day:any)=>({
                          x:fmtLabel(new Date(day.date+"T12:00:00")),
                          y:(day.ctr||0)*100
                        }))
                      },
                      {
                        id:"ROAS",
                        data:(d.daily||[]).slice(-14).map((day:any)=>({
                          x:fmtLabel(new Date(day.date+"T12:00:00")),
                          y:day.roas||0
                        }))
                      }
                    ]}
                    theme={TK.nivoTheme}
                    colors={[GREEN,TK.accent]}
                    margin={{top:16,right:16,bottom:40,left:60}}
                    xScale={{type:"point"}}
                    yScale={{type:"linear",min:"auto",max:"auto"}}
                    axisBottom={{tickRotation:-45,tickPadding:8}}
                    axisLeft={{tickSize:4,tickPadding:8}}
                    enableGridX={false}
                    enableGridY={true}
                    lineWidth={2}
                    enablePoints={false}
                    enableCrosshair={true}
                    useMesh={true}
                    curve="monotoneX"
                  />
                </div>
              </div>
            </Reveal>
            <Reveal direction="right" delay={0.1}>
              <FatigueRadar escalando={12} estavel={8} fadigando={3} pausado={2}/>
            </Reveal>
          </div>

          <GradientSep />

          {/* 2-column grid: WinnersList + HeatmapPerformance */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))",gap:20,marginBottom:28}}>
            <Reveal direction="left" delay={0.15}>
              <WinnersList items={mockWinners} type="winners"/>
            </Reveal>
            <Reveal direction="right" delay={0.2}>
              <HeatmapPerformance data={mockHeatmap} metric="ctr"/>
            </Reveal>
          </div>

          <GradientSep />

          {/* Full-width CreativeRaceBar */}
          <Reveal delay={0.25}>
            <div style={{marginBottom:28}}>
              <CreativeRaceBar data={mockBump}/>
            </div>
          </Reveal>

          <GradientSep />

          {/* Top ads */}
          {(d.top_ads||[]).length>0&&(
            <Reveal>
              <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:16,padding:24}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                  <div>
                    <p style={{margin:0,fontSize:15,fontWeight:700,color:TX}}>Top anúncios</p>
                    <p style={{margin:"4px 0 0",fontSize:12,color:MT}}>Ordenados por spend · {dateLabel}</p>
                  </div>
                  <button onClick={()=>navigate("/dashboard/ai")} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",background:"transparent",border:`1px solid ${BD}`,borderRadius:8,color:MT,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:F}}>
                    Analisar com IA<ArrowUpRight size={12}/>
                  </button>
                </div>
                <div style={{display:"flex",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${BD}`,marginTop:16,gap:0}}>
                  <span style={{width:28,flexShrink:0}}/>
                  <span style={{flex:1,fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em"}}>Anúncio</span>
                  <span style={{width:COL.spend,fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",textAlign:"right" as const,flexShrink:0}}>Spend</span>
                  <span style={{width:COL.ctr,fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",textAlign:"right" as const,flexShrink:0}}>CTR</span>
                  <span style={{width:COL.roas,fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",textAlign:"right" as const,flexShrink:0}}>ROAS</span>
                  <span style={{width:COL.status,fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",textAlign:"right" as const,flexShrink:0}}>Status</span>
                </div>
                <AdsCompact ads={d.top_ads||[]}/>
              </div>
            </Reveal>
          )}
        </>
      )}

      {/* ── Ads tab — Ad Diary ── */}
      {activeTab === "ads" && <AdDiary propUser={user} propPersona={selectedPersona} propLang={language} embedded/>}
    </div>
  );
}
