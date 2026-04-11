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
// AdDiary moved to Ad Score page
import { SparklineCard } from "@/components/ui/SparklineCard";
import { Reveal } from "@/components/ui/Reveal";
import { ResponsiveLine } from "@nivo/line";
import { ADBRIEF_TOKENS as TK } from "@/styles/tokens";

// ── Design tokens ────────────────────────────────────────────────────────────
const F = "'DM Sans','Plus Jakarta Sans',system-ui,sans-serif";
const MONO = "'DM Mono','SF Mono',monospace";
const BG = "var(--bg-main)";
const TX = "var(--text-primary)", MT = "var(--text-muted)";
const A = "#0da2e7"; // AdBrief accent
const GREEN = "#10b981", RED = "#ef4444", AMBER = "#f59e0b";

// ── Metrics ──────────────────────────────────────────────────────────────────
type MetricKey = "spend"|"ctr"|"clicks"|"impressions"|"conversions"|"roas"|"cpa"|"cpm"|"cpc"|"reach"|"frequency"|"conv_value";

interface MetricDef {
  key: MetricKey; label: string; labelPt: string; labelEs: string;
  icon: any; format: (v: number, lang?: string) => string;
  higherIsBetter: boolean; platforms: ("meta"|"both")[];
}

const METRICS: MetricDef[] = [
  { key:"spend",       label:"Ad Spend",    labelPt:"Gasto",        labelEs:"Gasto",        icon:DollarSign,  format:(v,lang)=>{ const s=lang==="pt"?"R$":"$"; if(v>=1e6)return s+(v/1e6).toFixed(1)+"M"; if(v>=1000)return s+(v/1000).toFixed(1)+"k"; return s+v.toFixed(0); },    higherIsBetter:false, platforms:["both"]   },
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

  return (
    <div ref={ref} style={{
      position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:999,
      background:"#0c0e14",border:`1px solid ${A}20`,borderRadius:16,
      boxShadow:`0 20px 60px rgba(0,0,0,0.7),0 0 40px ${A}08`,
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


// ── Meta logo SVG ────────────────────────────────────────────────────────────
function MetaLogo({ size=14 }: {size?:number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill={A} fillOpacity="0.15"/>
      <path d="M8.5 8c-1.1 0-2 1.5-2 3.5S7.4 15 8.5 15c.7 0 1.3-.6 2-1.8l1.5-2.4c.7-1.2 1.3-1.8 2-1.8 1.1 0 2 1.5 2 3.5S15.1 16 14 16c-.7 0-1.3-.6-2-1.8" stroke={A} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
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
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date|null>(null);
  const [visibleSections, setVisibleSections] = useState<Set<SectionKey>>(new Set(["cards","trend"]));

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
                <Calendar size={13}/>{dateLabel}
              </button>
              {showCalendar&&<CalendarPicker value={dateRange} onChange={r=>{setDateRange(r);}} onClose={()=>setShowCalendar(false)}/>}
            </div>

            {/* Metric customizer */}
            <div style={{position:"relative"}}>
              <button onClick={()=>{setShowCustomizer(!showCustomizer);setShowCalendar(false);}}
                style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:showCustomizer?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)",border:`1px solid ${showCustomizer?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.07)"}`,borderRadius:8,color:showCustomizer?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.50)",fontSize:13,cursor:"pointer",fontFamily:F,transition:"all 0.15s"}}>
                <Settings2 size={13}/>
                <span style={{fontWeight:600,fontSize:12}}>Métricas</span>
                <span style={{fontSize:11,background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.55)",borderRadius:5,padding:"1px 6px",fontWeight:700,fontFamily:MONO}}>{activeMetrics.length}</span>
              </button>
              {showCustomizer&&<MetricCustomizer active={activeMetrics} platform={activePlatform} onChange={setActiveMetrics} onClose={()=>setShowCustomizer(false)}/>}
            </div>

            {/* Refresh */}
            <button onClick={()=>load(true)} style={{display:"flex",alignItems:"center",padding:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,color:"rgba(255,255,255,0.45)",cursor:"pointer",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(255,255,255,0.70)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.color="rgba(255,255,255,0.45)";}}>
              <RefreshCw size={13} style={{animation:refreshing?"spin 1s linear infinite":"none"}}/>
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
              <div key={i} style={{height:130,background:`${A}04`,borderRadius:14,border:`1px solid ${A}08`,opacity:1-i*0.08,animation:"fadeIn 0.4s ease both",animationDelay:`${i*0.05}s`}}/>
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
                    style={{animationDelay:`${i*0.04}s`}}>
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
