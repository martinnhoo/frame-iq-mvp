// PerformanceDashboard v2 — real-time data from Meta + Google Ads APIs via live-metrics
import { useEffect, useState, useMemo, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, DollarSign, MousePointer, Target, Eye, Zap, ChevronUp, ChevronDown, Rocket, ArrowUpRight, AlertCircle, Link2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

type Period = "7d" | "14d" | "30d" | "60d" | "90d";

const F = "'DM Sans','Plus Jakarta Sans',system-ui,sans-serif";
const BG="#0e1118",S1="#141824",S2="#1a2135",BD="rgba(255,255,255,0.07)";
const TX="#eef0f6",MT="rgba(255,255,255,0.40)",ACCENT="#0ea5e9";
const GREEN="#22c55e",RED="#ef4444",AMBER="#f59e0b",GBLUE="#4285F4";

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({data,color}:{data:number[];color:string}) {
  if(!data||data.length<2)return null;
  const w=80,h=32,min=Math.min(...data),max=Math.max(...data),range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/range)*(h-4)-2}`);
  const path=`M ${pts.join(" L ")}`;
  const area=`M 0,${h} L ${path.slice(2)} L ${w},${h} Z`;
  return(
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{overflow:"visible"}}>
      <path d={area} fill={`${color}18`}/>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

// ── Area chart ────────────────────────────────────────────────────────────────
function AreaChart({daily}:{daily:{date:string;spend:number;ctr:number}[]}) {
  if(!daily||daily.length<2)return null;
  const W=800,H=200,PAD={top:16,right:16,bottom:32,left:60};
  const iW=W-PAD.left-PAD.right,iH=H-PAD.top-PAD.bottom;
  const maxS=Math.max(...daily.map(d=>d.spend),1);
  const maxC=Math.max(...daily.map(d=>d.ctr*100),0.01);
  const sPts=daily.map((_,i)=>[PAD.left+(i/(daily.length-1||1))*iW,PAD.top+iH-(daily[i].spend/maxS)*iH]);
  const cPts=daily.map((_,i)=>[PAD.left+(i/(daily.length-1||1))*iW,PAD.top+iH-((daily[i].ctr*100)/maxC)*iH]);
  const sPath=sPts.map((p,i)=>`${i===0?"M":"L"} ${p[0]} ${p[1]}`).join(" ");
  const cPath=cPts.map((p,i)=>`${i===0?"M":"L"} ${p[0]} ${p[1]}`).join(" ");
  const sArea=`${sPath} L ${sPts[sPts.length-1][0]} ${PAD.top+iH} L ${PAD.left} ${PAD.top+iH} Z`;
  const cArea=`${cPath} L ${cPts[cPts.length-1][0]} ${PAD.top+iH} L ${PAD.left} ${PAD.top+iH} Z`;
  const ticks=[0,maxS/2,maxS].map(v=>({y:PAD.top+iH-(v/maxS)*iH,label:v>=1000?`R$${(v/1000).toFixed(0)}k`:`R$${v.toFixed(0)}`}));
  const labelIdx=[0,Math.floor(daily.length/2),daily.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  return(
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity="0.3"/><stop offset="100%" stopColor={ACCENT} stopOpacity="0.02"/></linearGradient>
        <linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN} stopOpacity="0.25"/><stop offset="100%" stopColor={GREEN} stopOpacity="0.02"/></linearGradient>
      </defs>
      {ticks.map((t,i)=>(
        <g key={i}>
          <line x1={PAD.left} y1={t.y} x2={W-PAD.right} y2={t.y} stroke={BD} strokeWidth={1} strokeDasharray="4,4"/>
          <text x={PAD.left-8} y={t.y+4} textAnchor="end" style={{fontSize:10,fill:MT,fontFamily:F}}>{t.label}</text>
        </g>
      ))}
      <path d={sArea} fill="url(#lg1)"/>
      <path d={cArea} fill="url(#lg2)"/>
      <path d={sPath} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      <path d={cPath} fill="none" stroke={GREEN} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      {sPts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={3} fill={ACCENT} stroke={S1} strokeWidth={2}/>)}
      {labelIdx.map(i=>{
        const d=new Date(daily[i].date+"T12:00:00");
        return<text key={i} x={sPts[i][0]} y={H-6} textAnchor="middle" style={{fontSize:10,fill:MT,fontFamily:F}}>{d.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}</text>;
      })}
    </svg>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────
function Delta({value}:{value:number|null}) {
  if(value===null||isNaN(value))return<span style={{color:MT,fontSize:12}}>—</span>;
  const up=value>=0;
  const Icon=up?ChevronUp:ChevronDown;
  return<span style={{display:"inline-flex",alignItems:"center",gap:2,fontSize:12,fontWeight:600,color:up?GREEN:RED}}><Icon size={12}/>{Math.abs(value).toFixed(1)}%</span>;
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({label,value,delta,suffix,prefix,sparkData,accent,icon:Icon}:{label:string;value:string;delta?:number|null;suffix?:string;prefix?:string;sparkData?:number[];accent?:string;icon?:any}) {
  const c=accent||ACCENT;
  return(
    <div style={{background:"linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)",border:"1px solid rgba(255,255,255,0.09)",borderTopColor:"rgba(255,255,255,0.15)",boxShadow:"0 4px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",borderRadius:16,padding:"20px 24px",display:"flex",flexDirection:"column",gap:12,transition:"border-color 0.2s",cursor:"default"}}
      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=`${c}40`;}}
      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=BD;}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {Icon&&<div style={{width:28,height:28,borderRadius:8,background:`${c}15`,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={14} color={c}/></div>}
          <span style={{fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</span>
        </div>
        {sparkData&&<Sparkline data={sparkData} color={c}/>}
      </div>
      <div>
        <div style={{fontSize:32,fontWeight:800,color:TX,letterSpacing:"-0.03em",lineHeight:1}}>
          {prefix}<span>{value}</span>{suffix&&<span style={{fontSize:18,fontWeight:600,color:MT,marginLeft:2}}>{suffix}</span>}
        </div>
        {delta!==undefined&&delta!==null&&(
          <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
            <Delta value={delta}/>
            <span style={{fontSize:12,color:MT}}>vs período anterior</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Platform badge ────────────────────────────────────────────────────────────
function PlatformBadge({platform}:{platform:string}) {
  const isMeta=platform==="meta";
  return(
    <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:6,background:isMeta?"rgba(14,165,233,0.1)":"rgba(66,133,244,0.1)",border:`1px solid ${isMeta?"rgba(14,165,233,0.25)":"rgba(66,133,244,0.25)"}`,color:isMeta?ACCENT:GBLUE}}>
      {isMeta?"Meta":"Google"}
    </span>
  );
}

// ── Ad row ────────────────────────────────────────────────────────────────────
function AdRow({ad,rank}:{ad:any;rank:number}) {
  const ctr=(ad.ctr||0)*100;
  const isWinner=ctr>2||(ad.roas&&ad.roas>2);
  const isPauser=ctr<0.3&&ad.spend>20;
  const badge=isWinner?{label:"↑ Escalar",color:GREEN,bg:"rgba(34,197,94,0.1)"}:isPauser?{label:"⏸ Pausar",color:RED,bg:"rgba(239,68,68,0.1)"}:null;
  return(
    <div style={{display:"flex",alignItems:"center",gap:16,padding:"13px 0",borderBottom:`1px solid ${BD}`}}>
      <span style={{width:20,fontSize:12,color:MT,fontWeight:600,flexShrink:0}}>{rank}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
          <p style={{margin:0,fontSize:13,fontWeight:500,color:TX,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ad.name||"—"}</p>
          <PlatformBadge platform={ad.platform||"meta"}/>
        </div>
        <p style={{margin:0,fontSize:11,color:MT}}>{ad.campaign||""}</p>
      </div>
      <div style={{display:"flex",gap:20,flexShrink:0,alignItems:"center"}}>
        <div style={{textAlign:"right"}}>
          <p style={{margin:0,fontSize:13,fontWeight:700,color:TX}}>R${(ad.spend||0).toFixed(0)}</p>
          <p style={{margin:0,fontSize:10,color:MT}}>Spend</p>
        </div>
        <div style={{textAlign:"right"}}>
          <p style={{margin:0,fontSize:13,fontWeight:700,color:ctr>2?GREEN:ctr<0.5?RED:TX}}>{ctr.toFixed(2)}%</p>
          <p style={{margin:0,fontSize:10,color:MT}}>CTR</p>
        </div>
        {ad.roas!=null&&(
          <div style={{textAlign:"right"}}>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:ad.roas>2?GREEN:TX}}>{ad.roas.toFixed(1)}×</p>
            <p style={{margin:0,fontSize:10,color:MT}}>ROAS</p>
          </div>
        )}
        {badge&&<span style={{fontSize:11,fontWeight:700,color:badge.color,background:badge.bg,borderRadius:6,padding:"3px 8px",whiteSpace:"nowrap"}}>{badge.label}</span>}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PerformanceDashboard() {
  const {user,selectedPersona} = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [period,setPeriod] = useState<Period>("7d");
  const [data,setData] = useState<any>(null);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [error,setError] = useState("");
  const [lastUpdated,setLastUpdated] = useState<Date|null>(null);

  const [activePlatform, setActivePlatform] = useState<"meta"|"google">("meta");

  const load = useCallback(async(showSpinner=false) => {
    if(!user||!selectedPersona)return;
    if(showSpinner)setRefreshing(true);
    else setLoading(true);
    setError("");
    try{
      const res = await supabase.functions.invoke("live-metrics",{
        body:{user_id:user.id,persona_id:selectedPersona.id,period},
      });
      if(res.error)throw new Error(res.error.message);
      setData(res.data);
      setLastUpdated(new Date());
    }catch(e){
      const msg = String(e);
      // Hide technical CORS/network errors — show friendly message instead
      if(msg.includes("CORS")||msg.includes("fetch")||msg.includes("network")||msg.includes("ERR_")){
        setError("__connection__");
      } else {
        setError(msg);
      }
    }finally{
      setLoading(false);
      setRefreshing(false);
    }
  },[user,selectedPersona,period]);

  useEffect(() => { load(); }, [load]);

  const hasMeta   = data?.meta   && !data.meta.error;
  const hasGoogle = data?.google && !data.google.error;
  const noConnections = !loading && !hasMeta && !hasGoogle;

  useEffect(() => {
    if (data) {
      if (hasMeta) setActivePlatform("meta");
      else if (hasGoogle) setActivePlatform("google");
    }
  }, [data, hasMeta, hasGoogle]);

  const d = activePlatform === "google" ? data?.google : data?.meta;

  const sparkSpend  = useMemo(()=>(d?.daily||[]).map((x:any)=>x.spend),[d]);
  const sparkCtr    = useMemo(()=>(d?.daily||[]).map((x:any)=>x.ctr*100),[d]);
  const sparkClicks = useMemo(()=>(d?.daily||[]).map((x:any)=>x.clicks),[d]);

  const fmtSpend=(v:number)=>v>=1000?`${(v/1000).toFixed(1)}k`:v.toFixed(0);
  const fmtNum=(v:number)=>v>=1000?`${(v/1000).toFixed(1)}k`:String(Math.round(v));

  return(
    <div style={{minHeight:"100%",background:BG,fontFamily:F,padding:"28px 32px 48px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .pdb{background:transparent;border:1px solid ${BD};color:${MT};border-radius:8px;padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;font-family:${F};}
        .pdb.act{background:${ACCENT};border-color:${ACCENT};color:#fff;}
        .pdb:hover:not(.act){border-color:rgba(255,255,255,0.2);color:${TX};}
      `}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:28,flexWrap:"wrap",gap:16}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <h1 style={{margin:0,fontSize:24,fontWeight:800,color:TX}}>{selectedPersona?.name||"Sua conta"}</h1>
            {(hasMeta||hasGoogle)&&!loading&&(
              <span style={{display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:GREEN,background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:20,padding:"3px 10px"}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:GREEN}}/>Live
              </span>
            )}
          </div>
          {lastUpdated&&(
            <p style={{margin:"4px 0 0",fontSize:11,color:MT}}>
              {language==="pt"?"Atualizado:":language==="es"?"Actualizado:":"Updated:"} {lastUpdated.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
              {" · "}{activePlatform==="meta"?"Meta Ads":"Google Ads"}
              {" · "}{period==="7d"?"7 dias":period==="14d"?"14 dias":period==="30d"?"30 dias":period==="60d"?"60 dias":"90 dias"}
            </p>
          )}
        </div>

        <div className="perf-actions" style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const}}>
          {/* Platform tabs — always visible */}
          <div style={{display:"flex",gap:2,background:S2,border:`1px solid ${BD}`,borderRadius:10,padding:3}}>
            {([["meta","Meta Ads","f",ACCENT],["google","Google Ads","G",GBLUE]] as const).map(([plt,label,glyph,color])=>{
              const active = activePlatform===plt;
              const hasData = plt==="meta" ? hasMeta : hasGoogle;
              return(
                <button key={plt} onClick={()=>hasData&&setActivePlatform(plt)}
                  style={{display:"flex",alignItems:"center",gap:7,padding:"6px 14px",borderRadius:8,border:"none",cursor:hasData?"pointer":"default",fontFamily:F,fontSize:13,fontWeight:active?700:500,background:active&&hasData?S1:"transparent",color:active&&hasData?color:hasData?MT:"rgba(255,255,255,0.2)",transition:"all 0.15s",boxShadow:active&&hasData?"0 1px 4px rgba(0,0,0,0.3)":"none",opacity:hasData?1:0.45}}>
                  <span style={{width:18,height:18,borderRadius:5,background:active&&hasData?`${color}20`:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:active&&hasData?color:hasData?MT:"rgba(255,255,255,0.2)",fontFamily:"serif"}}>{glyph}</span>
                  {label}
                  {!hasData&&<span style={{fontSize:9,color:"rgba(255,255,255,0.25)",marginLeft:2}}>—</span>}
                </button>
              );
            })}
          </div>
          {/* Period selector */}
          <div style={{display:"flex",gap:4,background:S1,border:`1px solid ${BD}`,borderRadius:10,padding:4}}>
            {(["7d","14d","30d","60d","90d"] as Period[]).map(p=>(
              <button key={p} className={`pdb${period===p?" act":""}`} onClick={()=>setPeriod(p)}>
                {p==="7d"?"7D":p==="14d"?"14D":p==="30d"?"30D":p==="60d"?"60D":"90D"}
              </button>
            ))}
          </div>
          <button onClick={()=>load(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",background:S1,border:`1px solid ${BD}`,borderRadius:10,color:TX,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:F}}>
            <RefreshCw size={14} style={{animation:refreshing?"spin 1s linear infinite":"none"}}/>
            {refreshing ? (language==="es"?"Actualizando...":language==="pt"?"Buscando...":"Fetching...") : (language==="es"?"Actualizar":language==="pt"?"Atualizar":"Refresh")}
          </button>
          <button onClick={()=>navigate("/dashboard/campaigns/new")} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"linear-gradient(135deg,#0ea5e9,#0891b2)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:F}}>
            <Rocket size={14}/>{language==="es"?"Nueva campaña":language==="pt"?"Nova campanha":"New campaign"}
          </button>
        </div>
      </div>

      {/* No persona selected */}
      {!selectedPersona&&!loading&&(
        <div style={{textAlign:"center",padding:"80px 20px"}}>
          <div style={{fontSize:48,marginBottom:16}}>🏢</div>
          <h3 style={{color:TX,fontSize:20,fontWeight:700,margin:"0 0 8px"}}>
            {language==="es"?"Selecciona una cuenta":language==="pt"?"Selecione uma conta":"Select an account"}
          </h3>
          <p style={{color:MT,fontSize:14,margin:"0 0 24px",maxWidth:360,marginInline:"auto",lineHeight:1.6}}>
            {language==="es"?"Elige la cuenta que quieres ver en el panel de performance.":language==="pt"?"Escolha a conta que quer visualizar no painel de performance.":"Choose the account you want to view in the performance dashboard."}
          </p>
          <button onClick={()=>navigate("/dashboard/accounts")} style={{padding:"10px 20px",background:ACCENT,color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:F}}>
            {language==="es"?"Ver cuentas":language==="pt"?"Ver contas":"View accounts"}
          </button>
        </div>
      )}

      {/* Error — connection issue */}
      {error==="__connection__"&&!loading&&(
        <div style={{textAlign:"center",padding:"80px 20px"}}>
          <div style={{fontSize:48,marginBottom:16}}>🔌</div>
          <h3 style={{color:TX,fontSize:20,fontWeight:700,margin:"0 0 8px"}}>
            {language==="es"?"Sin conexión con la cuenta":language==="pt"?"Sem conexão com a conta":"No connection to account"}
          </h3>
          <p style={{color:MT,fontSize:14,margin:"0 0 24px",maxWidth:380,marginInline:"auto",lineHeight:1.6}}>
            {language==="es"?"Conecta Meta Ads o Google Ads para ver tus datos en tiempo real.":language==="pt"?"Conecte Meta Ads ou Google Ads para ver seus dados em tempo real.":"Connect Meta Ads or Google Ads to see your real-time data."}
          </p>
          <button onClick={()=>navigate("/dashboard/accounts")} style={{padding:"10px 20px",background:ACCENT,color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:F}}>
            {language==="es"?"Conectar cuenta":language==="pt"?"Conectar conta":"Connect account"}
          </button>
        </div>
      )}

      {/* Error — technical */}
      {error&&error!=="__connection__"&&!loading&&(
        <div style={{display:"flex",gap:10,padding:"14px 18px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,marginBottom:24}}>
          <AlertCircle size={16} color={RED} style={{flexShrink:0,marginTop:1}}/>
          <p style={{margin:0,fontSize:13,color:"#f87171"}}>{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:16,marginBottom:16}}>
            {[...Array(4)].map((_,i)=><div key={i} style={{height:120,background:S1,borderRadius:16,animation:"pulse 1.5s ease-in-out infinite",border:`1px solid ${BD}`}}/>)}
          </div>
          <div style={{height:240,background:S1,borderRadius:16,animation:"pulse 1.5s ease-in-out infinite",border:`1px solid ${BD}`}}/>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        </div>
      )}

      {/* Data */}
      {!loading&&d&&(
        <>
          {/* Individual platform errors */}
          {data?.meta?.error&&(
            <div style={{display:"flex",gap:8,padding:"10px 14px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,marginBottom:16}}>
              <AlertCircle size={14} color={AMBER} style={{flexShrink:0,marginTop:1}}/>
              <p style={{margin:0,fontSize:13,color:AMBER}}>Meta Ads: {data.meta.error}. Verifique a conexão em Accounts.</p>
            </div>
          )}
          {data?.google?.error&&(
            <div style={{display:"flex",gap:8,padding:"10px 14px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,marginBottom:16}}>
              <AlertCircle size={14} color={AMBER} style={{flexShrink:0,marginTop:1}}/>
              <p style={{margin:0,fontSize:13,color:AMBER}}>Google Ads: {data.google.error}. Verifique a conexão em Accounts.</p>
            </div>
          )}

          {/* Metrics grid — platform specific */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:16,marginBottom:16}}>
            <MetricCard label={language==="pt"?"Gasto total":language==="es"?"Gasto total":"Ad Spend"} value={`R$ ${fmtSpend(d.spend||0)}`} delta={d.delta_spend} sparkData={sparkSpend} accent={ACCENT} icon={DollarSign}/>
            <MetricCard label="CTR" value={((d.ctr||0)*100).toFixed(2)} suffix="%" delta={d.delta_ctr} sparkData={sparkCtr} accent={GREEN} icon={MousePointer}/>
            <MetricCard label={language==="pt"?"Cliques":language==="es"?"Clics":"Clicks"} value={fmtNum(d.clicks||0)} delta={d.delta_clicks} sparkData={sparkClicks} accent="#a78bfa" icon={Target}/>
            {activePlatform==="meta" ? (
              <MetricCard label="Impressões" value={fmtNum(d.impressions||0)} accent="#f97316" icon={Eye}/>
            ) : (
              <MetricCard label={language==="pt"?"Conversões":language==="es"?"Conversiones":"Conversions"} value={fmtNum(d.conversions||0)} accent={AMBER} icon={Eye}/>
            )}
          </div>
          {/* Platform-specific second row */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16,marginBottom:24}}>
            <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:16,padding:"20px 24px"}}>
              <p style={{margin:"0 0 12px",fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.07em"}}>ROAS</p>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <span style={{fontSize:40,fontWeight:800,color:d.roas?(d.roas>2?GREEN:d.roas>1?AMBER:RED):MT,letterSpacing:"-0.03em"}}>
                  {d.roas?`${d.roas.toFixed(2)}×`:"—"}
                </span>
              </div>
              <p style={{margin:"8px 0 0",fontSize:12,color:MT}}>{language==="pt"?"Retorno sobre investimento":language==="es"?"Retorno sobre inversión":"Return on ad spend"}</p>
            </div>
            <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:16,padding:"20px 24px"}}>
              <p style={{margin:"0 0 12px",fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.07em"}}>CPA</p>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <span style={{fontSize:40,fontWeight:800,color:TX,letterSpacing:"-0.03em"}}>
                  {d.cpa?`R$${d.cpa.toFixed(0)}`:"—"}
                </span>
              </div>
              <p style={{margin:"8px 0 0",fontSize:12,color:MT}}>{language==="pt"?"Custo por aquisição":language==="es"?"Costo por adquisición":"Cost per acquisition"}</p>
            </div>
            {activePlatform==="meta" ? (
              <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:16,padding:"20px 24px"}}>
                <p style={{margin:"0 0 12px",fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.07em"}}>CPM</p>
                <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                  <span style={{fontSize:40,fontWeight:800,color:TX,letterSpacing:"-0.03em"}}>
                    {d.impressions&&d.spend?`R$${((d.spend/d.impressions)*1000).toFixed(2)}`:"—"}
                  </span>
                </div>
                <p style={{margin:"8px 0 0",fontSize:12,color:MT}}>Custo por mil impressões</p>
              </div>
            ) : (
              <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:16,padding:"20px 24px"}}>
                <p style={{margin:"0 0 12px",fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.07em"}}>CPC</p>
                <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                  <span style={{fontSize:40,fontWeight:800,color:TX,letterSpacing:"-0.03em"}}>
                    {d.clicks&&d.spend?`R$${(d.spend/d.clicks).toFixed(2)}`:"—"}
                  </span>
                </div>
                <p style={{margin:"8px 0 0",fontSize:12,color:MT}}>Custo por clique</p>
              </div>
            )}
            <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:16,padding:"20px 24px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
              <p style={{margin:"0 0 12px",fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.07em"}}>{language==="pt"?"Ações rápidas":language==="es"?"Acciones rápidas":"Quick actions"}</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <button onClick={()=>navigate("/dashboard/campaigns/new")} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"rgba(14,165,233,0.1)",border:"1px solid rgba(14,165,233,0.2)",borderRadius:10,color:ACCENT,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:F,textAlign:"left"}}>
                  <Rocket size={13}/>{language==="pt"?"Criar campanha":language==="es"?"Crear campaña":"New campaign"}
                </button>
                <button onClick={()=>navigate("/dashboard/hooks")} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:10,color:"#a78bfa",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:F,textAlign:"left"}}>
                  <Zap size={13}/>{language==="pt"?"Gerar hooks":language==="es"?"Generar hooks":"Generate hooks"}
                </button>
              </div>
            </div>
          </div>

          {/* Chart */}
          {(d.daily||[]).length>1&&(
            <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:16,padding:24,marginBottom:24}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                <div>
                  <p style={{margin:0,fontSize:15,fontWeight:700,color:TX}}>Tendência de Performance</p>
                  <p style={{margin:"4px 0 0",fontSize:12,color:MT}}>
                    Dados em tempo real · {period==="7d"?"7 dias":period==="14d"?"14 dias":"30 dias"}
                    {" · "}{activePlatform==="meta"?"Meta Ads":"Google Ads"}
                  </p>
                </div>
                <div style={{display:"flex",gap:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:24,height:2,background:ACCENT,borderRadius:1}}/><span style={{fontSize:12,color:MT}}>Spend</span></div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:24,height:2,background:GREEN,borderRadius:1}}/><span style={{fontSize:12,color:MT}}>CTR</span></div>
                </div>
              </div>
              <AreaChart daily={d.daily}/>
            </div>
          )}

          {/* Top ads */}
          {(d.top_ads||[]).length>0&&(
            <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:16,padding:24}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                <div>
                  <p style={{margin:0,fontSize:15,fontWeight:700,color:TX}}>Top anúncios</p>
                  <p style={{margin:"4px 0 0",fontSize:12,color:MT}}>Ordenados por spend · dados ao vivo</p>
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
