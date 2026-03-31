// PerformanceDashboard v3 — calendar date picker, all metrics, drag & drop customization
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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

// ── Constants ─────────────────────────────────────────────────────────────────
const F = "'DM Sans','Plus Jakarta Sans',system-ui,sans-serif";
const BG = "#090c14", S1 = "#0f1520", S2 = "#141e2e", BD = "rgba(255,255,255,0.07)";
const TX = "#eef0f6", MT = "rgba(255,255,255,0.38)", ACCENT = "#0ea5e9";
const GREEN = "#22c55e", RED = "#ef4444", AMBER = "#f59e0b", GBLUE = "#4285F4";

// ── All available metrics ─────────────────────────────────────────────────────
type MetricKey = "spend"|"ctr"|"clicks"|"impressions"|"conversions"|"roas"|"cpa"|"cpm"|"cpc"|"reach"|"frequency"|"conv_value";

interface MetricDef {
  key: MetricKey; label: string; labelPt: string; labelEs: string;
  icon: any; accent: string; format: (v: number) => string;
  higherIsBetter: boolean; platforms: ("meta"|"google"|"both")[];
}

const METRICS: MetricDef[] = [
  { key:"spend",       label:"Ad Spend",    labelPt:"Gasto",        labelEs:"Gasto",        icon:DollarSign,  accent:ACCENT,    format:(v)=>`R$${v>=1000?(v/1000).toFixed(1)+"k":v.toFixed(0)}`,   higherIsBetter:false, platforms:["both"]   },
  { key:"ctr",         label:"CTR",         labelPt:"CTR",          labelEs:"CTR",          icon:MousePointer,accent:GREEN,     format:(v)=>`${(v*100).toFixed(2)}%`,                                higherIsBetter:true,  platforms:["both"]   },
  { key:"clicks",      label:"Clicks",      labelPt:"Cliques",      labelEs:"Clics",        icon:Target,      accent:"#a78bfa", format:(v)=>v>=1000?(v/1000).toFixed(1)+"k":String(Math.round(v)), higherIsBetter:true,  platforms:["both"]   },
  { key:"impressions", label:"Impressions", labelPt:"Impressões",   labelEs:"Impresiones",  icon:Eye,         accent:"#f97316", format:(v)=>v>=1000?(v/1000).toFixed(0)+"k":String(Math.round(v)), higherIsBetter:true,  platforms:["meta"]   },
  { key:"conversions", label:"Conversions", labelPt:"Conversões",   labelEs:"Conversiones", icon:TrendingUp,  accent:AMBER,     format:(v)=>String(Math.round(v)),                                   higherIsBetter:true,  platforms:["both"]   },
  { key:"roas",        label:"ROAS",        labelPt:"ROAS",         labelEs:"ROAS",         icon:BarChart3,   accent:GREEN,     format:(v)=>`${v.toFixed(2)}×`,                                      higherIsBetter:true,  platforms:["both"]   },
  { key:"cpa",         label:"CPA",         labelPt:"CPA",          labelEs:"CPA",          icon:Activity,    accent:"#f43f5e", format:(v)=>`R$${v.toFixed(0)}`,                                     higherIsBetter:false, platforms:["both"]   },
  { key:"cpm",         label:"CPM",         labelPt:"CPM",          labelEs:"CPM",          icon:Users,       accent:"#06b6d4", format:(v)=>`R$${v.toFixed(2)}`,                                     higherIsBetter:false, platforms:["meta"]   },
  { key:"cpc",         label:"CPC",         labelPt:"CPC",          labelEs:"CPC",          icon:Repeat,      accent:"#8b5cf6", format:(v)=>`R$${v.toFixed(2)}`,                                     higherIsBetter:false, platforms:["google"] },
  { key:"reach",       label:"Reach",       labelPt:"Alcance",      labelEs:"Alcance",      icon:Users,       accent:"#14b8a6", format:(v)=>v>=1000?(v/1000).toFixed(0)+"k":String(Math.round(v)), higherIsBetter:true,  platforms:["meta"]   },
  { key:"frequency",   label:"Frequency",   labelPt:"Frequência",   labelEs:"Frecuencia",   icon:Repeat,      accent:AMBER,     format:(v)=>v.toFixed(2),                                            higherIsBetter:false, platforms:["meta"]   },
  { key:"conv_value",  label:"Conv. Value", labelPt:"Valor Conv.",  labelEs:"Valor Conv.",  icon:DollarSign,  accent:GREEN,     format:(v)=>`R$${v>=1000?(v/1000).toFixed(1)+"k":v.toFixed(0)}`,   higherIsBetter:true,  platforms:["both"]   },
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

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data||data.length<2) return null;
  const w=80,h=28,min=Math.min(...data),max=Math.max(...data),range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/range)*(h-4)-2}`);
  const path=`M ${pts.join(" L ")}`;
  const area=`M 0,${h} L ${path.slice(2)} L ${w},${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{overflow:"visible"}}>
      <path d={area} fill={`${color}18`}/>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

// ── Area Chart ────────────────────────────────────────────────────────────────
function AreaChart({ daily, metricKey }: { daily: any[]; metricKey: MetricKey }) {
  if (!daily||daily.length<2) return null;
  const def = METRICS.find(m=>m.key===metricKey)!;
  const vals = daily.map(d=>getMetricValue(d,metricKey));
  const W=800,H=180,PAD={top:12,right:16,bottom:28,left:60};
  const iW=W-PAD.left-PAD.right,iH=H-PAD.top-PAD.bottom;
  const maxV=Math.max(...vals,0.001);
  const pts=vals.map((v,i)=>[PAD.left+(i/(vals.length-1||1))*iW, PAD.top+iH-(v/maxV)*iH]);
  const path=pts.map((p,i)=>`${i===0?"M":"L"} ${p[0]} ${p[1]}`).join(" ");
  const area=`${path} L ${pts[pts.length-1][0]} ${PAD.top+iH} L ${PAD.left} ${PAD.top+iH} Z`;
  const ticks=[0,maxV/2,maxV].map(v=>({y:PAD.top+iH-(v/maxV)*iH,label:def.format(v)}));
  const labelIdx=[0,Math.floor(daily.length/2),daily.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={def.accent} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={def.accent} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      {ticks.map((t,i)=>(
        <g key={i}>
          <line x1={PAD.left} y1={t.y} x2={W-PAD.right} y2={t.y} stroke={BD} strokeWidth={1} strokeDasharray="4,3"/>
          <text x={PAD.left-8} y={t.y+4} textAnchor="end" style={{fontSize:10,fill:MT,fontFamily:F}}>{t.label}</text>
        </g>
      ))}
      <path d={area} fill="url(#areaGrad)"/>
      <path d={path} fill="none" stroke={def.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      {pts.filter((_,i)=>daily.length<=14||i%Math.ceil(daily.length/14)===0).map((p,i)=>(
        <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={def.accent} stroke={S1} strokeWidth={2}/>
      ))}
      {labelIdx.map(i=>{
        const d=new Date(daily[i].date+"T12:00:00");
        return <text key={i} x={pts[i][0]} y={H-4} textAnchor="middle" style={{fontSize:10,fill:MT,fontFamily:F}}>{fmtLabel(d)}</text>;
      })}
    </svg>
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
            <div key={i} style={{textAlign:"center",fontSize:10,fontWeight:600,color:MT,padding:"4px 0",fontFamily:F}}>{d}</div>
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
                  textAlign:"center",padding:"6px 0",borderRadius:7,cursor:isFuture?"default":"pointer",
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
      background:S1,border:`1px solid ${BD}`,borderRadius:16,
      boxShadow:"0 20px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.04)",
      padding:20,width:560,display:"flex",flexDirection:"column",gap:16,
    }}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
        {PRESETS.map(p=>{
          const from=addDays(today,-p.days+1);
          const active=fmt(value.from)===fmt(from)&&fmt(value.to)===fmt(today);
          return (
            <button key={p.days} onClick={()=>{onChange({from,to:today});onClose();}}
              style={{fontFamily:F,fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:7,border:`1px solid ${active?ACCENT:BD}`,background:active?`${ACCENT}18`:"transparent",color:active?ACCENT:MT,cursor:"pointer",transition:"all 0.15s"}}>
              Últimos {p.label}
            </button>
          );
        })}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
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
function MetricCustomizer({ active, platform, onChange, onClose }: { active: MetricKey[]; platform:"meta"|"google"; onChange:(k:MetricKey[])=>void; onClose:()=>void }) {
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
    <div ref={ref} style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:999,background:S1,border:`1px solid ${BD}`,borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,0.6)",padding:20,width:300}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <span style={{fontFamily:F,fontSize:14,fontWeight:700,color:TX}}>Personalizar métricas</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:MT,cursor:"pointer",display:"flex"}}><X size={14}/></button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {available.map(m=>{
          const Icon=m.icon; const isActive=active.includes(m.key);
          return (
            <button key={m.key} onClick={()=>toggle(m.key)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,border:`1px solid ${isActive?m.accent+"40":BD}`,background:isActive?`${m.accent}10`:"transparent",cursor:"pointer",textAlign:"left",width:"100%",transition:"all 0.15s"}}>
              <div style={{width:26,height:26,borderRadius:7,background:isActive?`${m.accent}20`:S2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
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
      <p style={{fontFamily:F,fontSize:11,color:MT,marginTop:10,textAlign:"center"}}>{active.length}/{available.length} ativas · arraste cards para reordenar</p>
    </div>
  );
}

// ── Delta ─────────────────────────────────────────────────────────────────────
function Delta({ value, higherIsBetter }: { value:number|null; higherIsBetter:boolean }) {
  if(value===null||isNaN(value)) return <span style={{color:MT,fontSize:11}}>—</span>;
  const positive=higherIsBetter?value>=0:value<=0;
  const Icon=value>=0?TrendingUp:TrendingDown;
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,fontWeight:600,color:positive?GREEN:RED}}><Icon size={11}/>{Math.abs(value).toFixed(1)}%</span>;
}

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({ def, value, delta, sparkData, isDragging }: { def:MetricDef; value:number; delta?:number|null; sparkData?:number[]; isDragging?:boolean }) {
  const formatted = value>0?def.format(value):"—";
  return (
    <div style={{
      background:"linear-gradient(145deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.01) 100%)",
      border:`1px solid ${isDragging?def.accent+"60":BD}`,
      borderTopColor:isDragging?def.accent+"80":"rgba(255,255,255,0.12)",
      boxShadow:isDragging?`0 20px 60px rgba(0,0,0,0.6),0 0 0 1px ${def.accent}30`:"0 2px 12px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.06)",
      borderRadius:16,padding:"18px 20px",display:"flex",flexDirection:"column",gap:10,
      transition:"border-color 0.2s,box-shadow 0.2s",opacity:isDragging?0.9:1,
      cursor:"grab",height:"100%",boxSizing:"border-box" as const,
    }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <GripVertical size={13} color={MT} style={{opacity:0.5,flexShrink:0}}/>
          <div style={{width:25,height:25,borderRadius:7,background:`${def.accent}18`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <def.icon size={12} color={def.accent}/>
          </div>
          <span style={{fontFamily:F,fontSize:10,fontWeight:700,color:MT,textTransform:"uppercase",letterSpacing:"0.08em"}}>{def.labelPt}</span>
        </div>
        {sparkData&&<Sparkline data={sparkData} color={def.accent}/>}
      </div>
      <div>
        <div style={{fontSize:28,fontWeight:800,color:TX,letterSpacing:"-0.03em",lineHeight:1}}>{formatted}</div>
        {delta!==undefined&&delta!==null&&(
          <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
            <Delta value={delta} higherIsBetter={def.higherIsBetter}/>
            <span style={{fontSize:11,color:MT}}>vs anterior</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ad Row ────────────────────────────────────────────────────────────────────
function AdRow({ ad, rank }: { ad:any; rank:number }) {
  const ctr=(ad.ctr||0)*100;
  const isWinner=ctr>2||(ad.roas&&ad.roas>2);
  const isPauser=ctr<0.3&&ad.spend>20;
  const badge=isWinner?{label:"↑ Escalar",color:GREEN,bg:"rgba(34,197,94,0.1)"}:isPauser?{label:"⏸ Pausar",color:RED,bg:"rgba(239,68,68,0.1)"}:null;
  const isMeta=ad.platform==="meta";
  return (
    <div style={{display:"flex",alignItems:"center",gap:16,padding:"13px 0",borderBottom:`1px solid ${BD}`}}>
      <span style={{width:20,fontSize:12,color:MT,fontWeight:600,flexShrink:0}}>{rank}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
          <p style={{margin:0,fontSize:13,fontWeight:500,color:TX,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ad.name||"—"}</p>
          <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:5,background:isMeta?"rgba(14,165,233,0.1)":"rgba(66,133,244,0.1)",border:`1px solid ${isMeta?"rgba(14,165,233,0.25)":"rgba(66,133,244,0.25)"}`,color:isMeta?ACCENT:GBLUE,flexShrink:0}}>
            {isMeta?"Meta":"Google"}
          </span>
        </div>
        <p style={{margin:0,fontSize:11,color:MT}}>{ad.campaign||""}</p>
      </div>
      <div style={{display:"flex",gap:20,flexShrink:0,alignItems:"center"}}>
        <div style={{textAlign:"right"}}><p style={{margin:0,fontSize:13,fontWeight:700,color:TX}}>R${(ad.spend||0).toFixed(0)}</p><p style={{margin:0,fontSize:10,color:MT}}>Spend</p></div>
        <div style={{textAlign:"right"}}><p style={{margin:0,fontSize:13,fontWeight:700,color:ctr>2?GREEN:ctr<0.5?RED:TX}}>{ctr.toFixed(2)}%</p><p style={{margin:0,fontSize:10,color:MT}}>CTR</p></div>
        {ad.roas!=null&&<div style={{textAlign:"right"}}><p style={{margin:0,fontSize:13,fontWeight:700,color:ad.roas>2?GREEN:TX}}>{ad.roas.toFixed(1)}×</p><p style={{margin:0,fontSize:10,color:MT}}>ROAS</p></div>}
        {badge&&<span style={{fontSize:11,fontWeight:700,color:badge.color,background:badge.bg,borderRadius:6,padding:"3px 8px",whiteSpace:"nowrap"}}>{badge.label}</span>}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PerformanceDashboard() {
  const {user,selectedPersona} = useOutletContext<DashboardContext>();
  const {language} = useLanguage();
  const navigate = useNavigate();
  const lang = language as "pt"|"es"|"en";

  const today = useMemo(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; },[]);
  const [dateRange, setDateRange] = useState<DateRange>({from:addDays(today,-6),to:today});
  const [showCalendar, setShowCalendar] = useState(false);
  const [activePlatform, setActivePlatform] = useState<"meta"|"google">("meta");
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(()=>{ try{const s=localStorage.getItem("adbrief_perf_metrics"); return s?JSON.parse(s):DEFAULT_METRICS;}catch{return DEFAULT_METRICS;} });
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [chartMetric, setChartMetric] = useState<MetricKey>("spend");
  const [dragging, setDragging] = useState<number|null>(null);
  const [dragOver, setDragOver] = useState<number|null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date|null>(null);

  useEffect(()=>{ try{localStorage.setItem("adbrief_perf_metrics",JSON.stringify(activeMetrics));}catch{} },[activeMetrics]);

  const load = useCallback(async(showSpinner=false)=>{
    if(!user||!selectedPersona) return;
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
  const hasGoogle=data?.google&&!data.google.error;

  useEffect(()=>{ if(data){ if(hasMeta) setActivePlatform("meta"); else if(hasGoogle) setActivePlatform("google"); } },[data,hasMeta,hasGoogle]);

  const d = activePlatform==="google"?data?.google:data?.meta;

  const sparkData = useMemo(()=>{
    const daily=d?.daily||[];
    const result:Partial<Record<MetricKey,number[]>>={};
    for(const m of activeMetrics) result[m]=daily.map((day:any)=>getMetricValue(day,m));
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

  const handleDragStart=(i:number)=>setDragging(i);
  const handleDragOver=(e:React.DragEvent,i:number)=>{ e.preventDefault(); setDragOver(i); };
  const handleDrop=(i:number)=>{
    if(dragging===null||dragging===i){ setDragging(null); setDragOver(null); return; }
    const next=[...activeMetrics]; const [moved]=next.splice(dragging,1); next.splice(i,0,moved);
    setActiveMetrics(next); setDragging(null); setDragOver(null);
  };

  return (
    <div style={{minHeight:"100%",background:BG,fontFamily:F,padding:"24px 28px 60px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .perf-card{animation:fadeIn 0.3s ease both}
        .drag-over{border-color:${ACCENT}60!important;background:${ACCENT}08!important}
      `}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:14}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <h1 style={{margin:0,fontSize:22,fontWeight:800,color:TX,letterSpacing:"-0.03em"}}>{selectedPersona?.name||"Performance"}</h1>
            {(hasMeta||hasGoogle)&&!loading&&(
              <span style={{display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,color:GREEN,background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:20,padding:"3px 10px"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:GREEN,boxShadow:"0 0 6px #22c55e"}}/>LIVE
              </span>
            )}
          </div>
          {lastUpdated&&<p style={{margin:0,fontSize:11,color:MT}}>Atualizado {lastUpdated.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</p>}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
          {/* Platform tabs */}
          <div style={{display:"flex",gap:2,background:S2,border:`1px solid ${BD}`,borderRadius:10,padding:3}}>
            {([["meta","Meta Ads",ACCENT],["google","Google Ads",GBLUE]] as const).map(([plt,label,color])=>{
              const active=activePlatform===plt,hasData=plt==="meta"?hasMeta:hasGoogle;
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
              style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",background:showCalendar?`${ACCENT}15`:S1,border:`1px solid ${showCalendar?ACCENT+"50":BD}`,borderRadius:10,color:showCalendar?ACCENT:TX,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:F,transition:"all 0.15s"}}>
              <Calendar size={13}/>{dateLabel}
            </button>
            {showCalendar&&<CalendarPicker value={dateRange} onChange={r=>{setDateRange(r);}} onClose={()=>setShowCalendar(false)}/>}
          </div>

          {/* Metric customizer */}
          <div style={{position:"relative"}}>
            <button onClick={()=>{setShowCustomizer(!showCustomizer);setShowCalendar(false);}}
              style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:showCustomizer?`${ACCENT}15`:S1,border:`1px solid ${showCustomizer?ACCENT+"50":BD}`,borderRadius:10,color:showCustomizer?ACCENT:MT,fontSize:13,cursor:"pointer",fontFamily:F,transition:"all 0.15s"}}>
              <Settings2 size={14}/>
              <span style={{fontWeight:600}}>Métricas</span>
              <span style={{fontSize:11,background:`${ACCENT}20`,color:ACCENT,borderRadius:5,padding:"1px 6px",fontWeight:700}}>{activeMetrics.length}</span>
            </button>
            {showCustomizer&&<MetricCustomizer active={activeMetrics} platform={activePlatform} onChange={setActiveMetrics} onClose={()=>setShowCustomizer(false)}/>}
          </div>

          <button onClick={()=>load(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:S1,border:`1px solid ${BD}`,borderRadius:10,color:MT,fontSize:13,cursor:"pointer",fontFamily:F}}>
            <RefreshCw size={13} style={{animation:refreshing?"spin 1s linear infinite":"none"}}/>
          </button>
          <button onClick={()=>navigate("/dashboard/campaigns/new")} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",background:"linear-gradient(135deg,#0ea5e9,#0891b2)",border:"none",borderRadius:10,color:"#000",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F}}>
            <Rocket size={13}/>{lang==="pt"?"Nova campanha":lang==="es"?"Nueva campaña":"New campaign"}
          </button>
        </div>
      </div>

      {/* Empty states */}
      {!selectedPersona&&!loading&&(
        <div style={{textAlign:"center",padding:"80px 20px"}}>
          <div style={{fontSize:48,marginBottom:16}}>🏢</div>
          <h3 style={{color:TX,fontSize:20,fontWeight:700,margin:"0 0 8px"}}>Selecione uma conta</h3>
          <p style={{color:MT,fontSize:14,margin:"0 0 24px"}}>Escolha a conta para ver no painel.</p>
          <button onClick={()=>navigate("/dashboard/accounts")} style={{padding:"10px 20px",background:ACCENT,color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:F}}>Ver contas</button>
        </div>
      )}
      {error==="__connection__"&&!loading&&(
        <div style={{textAlign:"center",padding:"80px 20px"}}>
          <div style={{fontSize:48,marginBottom:16}}>🔌</div>
          <h3 style={{color:TX,fontSize:20,fontWeight:700,margin:"0 0 8px"}}>Sem conexão com a conta</h3>
          <p style={{color:MT,fontSize:14,margin:"0 0 24px",maxWidth:360,marginInline:"auto"}}>Conecte Meta Ads ou Google Ads para ver seus dados em tempo real.</p>
          <button onClick={()=>navigate("/dashboard/accounts")} style={{padding:"10px 20px",background:ACCENT,color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:F}}>Conectar conta</button>
        </div>
      )}
      {error&&error!=="__connection__"&&!loading&&(
        <div style={{display:"flex",gap:10,padding:"14px 18px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,marginBottom:24}}>
          <AlertCircle size={16} color={RED} style={{flexShrink:0,marginTop:1}}/>
          <p style={{margin:0,fontSize:13,color:"#f87171"}}>{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:14}}>
            {[...Array(6)].map((_,i)=>(
              <div key={i} style={{height:110,background:S1,borderRadius:16,border:`1px solid ${BD}`,opacity:1-i*0.08,animation:"fadeIn 0.4s ease both",animationDelay:`${i*0.05}s`}}/>
            ))}
          </div>
          <div style={{height:220,background:S1,borderRadius:16,border:`1px solid ${BD}`}}/>
        </div>
      )}

      {/* Platform error banners */}
      {!loading&&data&&(
        <>
          {data?.meta?.error&&<div style={{display:"flex",gap:8,padding:"10px 14px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,marginBottom:16}}><AlertCircle size={14} color={AMBER} style={{flexShrink:0,marginTop:1}}/><p style={{margin:0,fontSize:13,color:AMBER}}>Meta Ads: {data.meta.error}</p></div>}
          {data?.google?.error&&<div style={{display:"flex",gap:8,padding:"10px 14px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,marginBottom:16}}><AlertCircle size={14} color={AMBER} style={{flexShrink:0,marginTop:1}}/><p style={{margin:0,fontSize:13,color:AMBER}}>Google Ads: {data.google.error}</p></div>}
        </>
      )}

      {/* Metric cards — drag & drop */}
      {!loading&&d&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(195px,1fr))",gap:14,marginBottom:20}}>
            {activeMetrics.map((key,i)=>{
              const def=METRICS.find(m=>m.key===key);
              if(!def) return null;
              const value=getMetricValue(d,key);
              const delta=getMetricDelta(key);
              const spark=sparkData[key];
              return (
                <div key={key} draggable
                  onDragStart={()=>handleDragStart(i)}
                  onDragOver={e=>handleDragOver(e,i)}
                  onDrop={()=>handleDrop(i)}
                  onDragEnd={()=>{setDragging(null);setDragOver(null);}}
                  className={`perf-card${dragOver===i&&dragging!==i?" drag-over":""}`}
                  style={{animationDelay:`${i*0.04}s`}}>
                  <MetricCard def={def} value={value} delta={delta} sparkData={spark} isDragging={dragging===i}/>
                </div>
              );
            })}
          </div>

          {/* Chart */}
          {(d.daily||[]).length>1&&(
            <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:16,padding:24,marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap" as const,gap:12}}>
                <div>
                  <p style={{margin:0,fontSize:15,fontWeight:700,color:TX}}>Tendência</p>
                  <p style={{margin:"4px 0 0",fontSize:12,color:MT}}>{dateLabel} · {activePlatform==="meta"?"Meta Ads":"Google Ads"}</p>
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap" as const}}>
                  {activeMetrics.slice(0,6).map(key=>{
                    const def=METRICS.find(m=>m.key===key); if(!def) return null;
                    const active=chartMetric===key;
                    return (
                      <button key={key} onClick={()=>setChartMetric(key)}
                        style={{padding:"4px 10px",borderRadius:7,border:`1px solid ${active?def.accent+"60":BD}`,background:active?`${def.accent}15`:"transparent",color:active?def.accent:MT,fontSize:11,fontWeight:active?700:500,cursor:"pointer",fontFamily:F,transition:"all 0.15s"}}>
                        {def.labelPt}
                      </button>
                    );
                  })}
                </div>
              </div>
              <AreaChart daily={d.daily} metricKey={chartMetric}/>
            </div>
          )}

          {/* Top ads */}
          {(d.top_ads||[]).length>0&&(
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
              <div style={{display:"flex",alignItems:"center",gap:16,padding:"10px 0 10px 28px",borderBottom:`1px solid ${BD}`,marginTop:16}}>
                <span style={{flex:1,fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em"}}>Anúncio</span>
                <div style={{display:"flex",gap:20,flexShrink:0}}>
                  {["Spend","CTR","ROAS","Status"].map(h=><span key={h} style={{fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",width:h==="Status"?80:60,textAlign:"right"}}>{h}</span>)}
                </div>
              </div>
              {(d.top_ads||[]).slice(0,10).map((ad:any,i:number)=><AdRow key={ad.id||i} ad={ad} rank={i+1}/>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
