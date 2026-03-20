import { useState, useEffect, useRef } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Send, Loader2, ChevronDown, ChevronUp, Sparkles, RotateCcw, Brain, ArrowRight, TrendingUp, TrendingDown, BarChart2, AlertTriangle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const m = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as const;

const UI: Record<string, Record<string, string>> = {
  en: { title:"AdBrief AI", ready:"● READY — account data loaded", loading_ctx:"○ Loading your data...", connect_title:"Connect Meta Ads", connect_sub:"The AI needs your ad account to answer with real data.", connect_btn:"Connect Meta Ads →", connecting:"Redirecting...", connected:"Meta Ads connected — AI using your real data", empty_title:"Ask me anything about your ads.", empty_sub:"I have your campaign data, patterns, and metrics. Direct answers — no fluff.", placeholder:"Ask about your campaigns, hooks, performance...", footer:"Strictly ad performance & creative intelligence", clear:"Clear", open_tool:"Open tool →", running:"Running", q1:"What's killing my ROAS right now?", q2:"Which hook type is winning in my account?", q3:"My CTR dropped 40% — diagnose it.", q4:"Write 3 hooks based on my winning creatives.", q5:"Which market should I double down on?", q6:"What should I produce next week?" },
  pt: { title:"AdBrief AI", ready:"● PRONTO — dados da conta carregados", loading_ctx:"○ Carregando seus dados...", connect_title:"Conectar Meta Ads", connect_sub:"A IA precisa da sua conta de anúncios para responder com dados reais.", connect_btn:"Conectar Meta Ads →", connecting:"Redirecionando...", connected:"Meta Ads conectado — IA usando seus dados reais", empty_title:"Pergunte qualquer coisa sobre seus anúncios.", empty_sub:"Tenho seus dados de campanha, padrões e métricas. Respostas diretas — sem enrolação.", placeholder:"Pergunte sobre campanhas, hooks, performance...", footer:"Somente performance de anúncios e inteligência criativa", clear:"Limpar", open_tool:"Abrir ferramenta →", running:"Executando", q1:"O que está matando meu ROAS agora?", q2:"Qual tipo de hook está ganhando na minha conta?", q3:"Meu CTR caiu 40% — diagnostique.", q4:"Escreva 3 hooks baseados nos meus criativos vencedores.", q5:"Em qual mercado devo dobrar a aposta?", q6:"O que devo produzir semana que vem?" },
  es: { title:"AdBrief AI", ready:"● LISTO — datos de cuenta cargados", loading_ctx:"○ Cargando tus datos...", connect_title:"Conectar Meta Ads", connect_sub:"La IA necesita tu cuenta de anuncios para responder con datos reales.", connect_btn:"Conectar Meta Ads →", connecting:"Redirigiendo...", connected:"Meta Ads conectado — IA usando tus datos reales", empty_title:"Pregunta lo que quieras sobre tus anuncios.", empty_sub:"Tengo tus datos de campaña, patrones y métricas. Respuestas directas — sin rodeos.", placeholder:"Pregunta sobre campañas, hooks, rendimiento...", footer:"Solo inteligencia de rendimiento publicitario", clear:"Limpiar", open_tool:"Abrir herramienta →", running:"Ejecutando", q1:"¿Qué está matando mi ROAS ahora mismo?", q2:"¿Qué tipo de hook está ganando en mi cuenta?", q3:"Mi CTR cayó 40% — diagnostícalo.", q4:"Escribe 3 hooks basados en mis creativos ganadores.", q5:"¿En qué mercado debería doblar la apuesta?", q6:"¿Qué debería producir la próxima semana?" },
};
function ui(lang: string, key: string): string { return (UI[lang] || UI.en)[key] || UI.en[key] || key; }

interface Block {
  type: "action"|"pattern"|"hooks"|"warning"|"insight"|"off_topic"|"navigate"|"tool_call"|"dashboard";
  title: string; content?: string; items?: string[]; route?: string; params?: Record<string,string>; cta?: string;
  tool?: string; tool_params?: Record<string,string>;
  metrics?: { label:string; value:string; delta?:string; trend?:"up"|"down"|"neutral" }[];
  table?: { headers:string[]; rows:string[][] };
  chart?: { type:"bar"|"comparison"; labels:string[]; values:number[]; colors?:string[] };
}
interface AIMessage { role:"user"|"assistant"; blocks?: Block[]; userText?:string; ts:number; }

const BS: Record<string,{color:string;bg:string;border:string}> = {
  action:   {color:"#0ea5e9",bg:"rgba(14,165,233,0.06)",border:"rgba(14,165,233,0.18)"},
  pattern:  {color:"#60a5fa",bg:"rgba(96,165,250,0.06)",border:"rgba(96,165,250,0.18)"},
  hooks:    {color:"#06b6d4",bg:"rgba(6,182,212,0.06)",border:"rgba(6,182,212,0.18)"},
  warning:  {color:"#fbbf24",bg:"rgba(251,191,36,0.06)",border:"rgba(251,191,36,0.18)"},
  insight:  {color:"#34d399",bg:"rgba(52,211,153,0.06)",border:"rgba(52,211,153,0.18)"},
  off_topic:{color:"rgba(255,255,255,0.3)",bg:"rgba(255,255,255,0.02)",border:"rgba(255,255,255,0.07)"},
  navigate: {color:"#0ea5e9",bg:"rgba(14,165,233,0.04)",border:"rgba(14,165,233,0.2)"},
  tool_call:{color:"#a78bfa",bg:"rgba(167,139,250,0.06)",border:"rgba(167,139,250,0.2)"},
  dashboard:{color:"#34d399",bg:"rgba(13,17,23,0.9)",border:"rgba(255,255,255,0.1)"},
};

function DashboardBlock({block}:{block:Block}) {
  const cols = !block.metrics?.length ? 1 : block.metrics.length <= 2 ? block.metrics.length : block.metrics.length <= 4 ? 2 : 3;
  return (
    <div style={{borderRadius:18,border:"1px solid rgba(14,165,233,0.18)",background:"linear-gradient(135deg,rgba(14,165,233,0.05) 0%,rgba(6,182,212,0.02) 100%)",overflow:"hidden",marginBottom:12,boxShadow:"0 8px 32px rgba(0,0,0,0.3)"}}>
      {/* Header */}
      <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:30,height:30,borderRadius:9,background:"linear-gradient(135deg,#0ea5e9,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <BarChart2 size={14} color="#000"/>
        </div>
        <div style={{flex:1}}>
          <p style={{...j,fontSize:13,fontWeight:800,color:"#fff",lineHeight:1,marginBottom:2}}>{block.title}</p>
          {block.content&&<p style={{...m,fontSize:10,color:"rgba(255,255,255,0.38)",margin:0,lineHeight:1.4}}>{block.content}</p>}
        </div>
        <span style={{...m,fontSize:8.5,color:"rgba(14,165,233,0.5)",letterSpacing:"0.14em",textTransform:"uppercase"}}>LIVE DATA</span>
      </div>
      {/* Metrics grid */}
      {block.metrics && block.metrics.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:"1px",background:"rgba(255,255,255,0.04)"}}>
          {block.metrics.map((metric,i)=>{
            const isUp=metric.trend==="up", isDown=metric.trend==="down";
            const mColor=isDown?"#f87171":isUp?"#34d399":"#e2e8f0";
            return(
              <div key={i} style={{padding:"18px 20px",background:"#080c14",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-24,right:-24,width:90,height:90,borderRadius:"50%",background:`radial-gradient(circle,${mColor}12,transparent 65%)`,pointerEvents:"none"}}/>
                <p style={{...m,fontSize:9,color:"rgba(255,255,255,0.28)",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:8}}>{metric.label}</p>
                <p style={{...j,fontSize:30,fontWeight:900,color:mColor,letterSpacing:"-0.04em",lineHeight:1,marginBottom:8}}>{metric.value}</p>
                {metric.delta&&(
                  <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:6,background:isDown?"rgba(248,113,113,0.1)":isUp?"rgba(52,211,153,0.1)":"rgba(255,255,255,0.05)",border:`1px solid ${isDown?"rgba(248,113,113,0.2)":isUp?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.08)"}`}}>
                    {isDown?<TrendingDown size={9} color="#f87171"/>:isUp?<TrendingUp size={9} color="#34d399"/>:null}
                    <span style={{...m,fontSize:10,fontWeight:600,color:isDown?"#f87171":isUp?"#34d399":"rgba(255,255,255,0.4)"}}>{metric.delta}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Bar chart */}
      {block.chart&&block.chart.type==="bar"&&(
        <div style={{padding:"16px 18px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
          {block.chart.labels.map((label,i)=>{
            const max=Math.max(...block.chart!.values);
            const pct=max>0?(block.chart!.values[i]/max)*100:0;
            const color=block.chart!.colors?.[i]||"#0ea5e9";
            return(
              <div key={i} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{...m,fontSize:11,color:"rgba(255,255,255,0.65)"}}>{label}</span>
                  <span style={{...j,fontSize:11,fontWeight:700,color:"#fff"}}>{block.chart!.values[i]}</span>
                </div>
                <div style={{height:7,background:"rgba(255,255,255,0.05)",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${color},${color}aa)`,borderRadius:4,transition:"width 0.6s ease"}}/>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Table */}
      {block.table&&(
        <div style={{overflowX:"auto",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"rgba(255,255,255,0.02)"}}>
                {block.table.headers.map((h,i)=>(
                  <th key={i} style={{...m,fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.28)",textAlign:"left",padding:"9px 16px",letterSpacing:"0.1em",textTransform:"uppercase",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.table.rows.map((row,ri)=>(
                <tr key={ri} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                  {row.map((cell,ci)=>(
                    <td key={ci} style={{...m,fontSize:12,color:ci===0?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.55)",padding:"11px 16px",fontWeight:ci===0?600:400}}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BlockCard({block,onNavigate,lang}:{block:Block;onNavigate?:(r:string,p?:Record<string,string>)=>void;lang:string}) {
  const s=BS[block.type]||BS.insight;
  const [open,setOpen]=useState(true);
  if(block.type==="dashboard") return <DashboardBlock block={block}/>;
  if(block.type==="navigate") return (
    <div style={{borderRadius:14,border:`1px solid ${s.border}`,background:s.bg,marginBottom:8,padding:"14px 16px"}}>
      <p style={{...j,fontSize:12,fontWeight:700,color:s.color,marginBottom:6}}>{block.title}</p>
      {block.content&&<p style={{...m,fontSize:12,color:"rgba(255,255,255,0.55)",lineHeight:1.65,marginBottom:12}}>{block.content}</p>}
      <button onClick={()=>onNavigate?.(block.route!,block.params)}
        style={{display:"inline-flex",alignItems:"center",gap:8,padding:"9px 16px",borderRadius:10,background:"linear-gradient(135deg,#0ea5e9,#06b6d4)",color:"#000",fontSize:12,fontWeight:700,cursor:"pointer",border:"none",...j}}>
        {block.cta||ui(lang,"open_tool")} <ArrowRight size={13}/>
      </button>
    </div>
  );
  if(block.type==="tool_call") return (
    <div style={{borderRadius:14,border:`1px solid ${s.border}`,background:s.bg,marginBottom:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
      <Loader2 size={13} color={s.color} className="animate-spin"/>
      <span style={{...j,fontSize:12,color:s.color,fontWeight:600}}>{ui(lang,"running")} {block.tool}...</span>
    </div>
  );
  const ICON_MAP: Record<string,React.ReactNode> = {action:<Zap size={12}/>,pattern:<BarChart2 size={12}/>,hooks:<Sparkles size={12}/>,warning:<AlertTriangle size={12}/>,insight:<Brain size={12}/>};
  return (
    <div style={{borderRadius:14,border:`1px solid ${s.border}`,background:s.bg,overflow:"hidden",marginBottom:8}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"11px 14px",background:"none",border:"none",cursor:"pointer"}}>
        <span style={{color:s.color,display:"flex"}}>{ICON_MAP[block.type]||<Sparkles size={12}/>}</span>
        <span style={{...j,flex:1,fontSize:12,fontWeight:700,color:s.color,textAlign:"left"}}>{block.title}</span>
        {open?<ChevronUp size={13} color={s.color}/>:<ChevronDown size={13} color={s.color}/>}
      </button>
      {open&&<div style={{padding:"0 14px 12px"}}>
        {block.content&&<p style={{...m,fontSize:12,color:"rgba(255,255,255,0.65)",lineHeight:1.75,marginBottom:block.items?.length?10:0}}>{block.content}</p>}
        {block.items?.map((item,i)=>(
          <div key={i} style={{display:"flex",gap:10,marginBottom:8,padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)"}}>
            <span style={{color:s.color,fontSize:11,marginTop:1,flexShrink:0,fontWeight:700}}>{i+1}.</span>
            <span style={{...m,fontSize:12,color:"rgba(255,255,255,0.82)",lineHeight:1.6}}>{item}</span>
          </div>
        ))}
      </div>}
    </div>
  );
}

export default function AdBriefAI() {
  const {user}=useOutletContext<DashboardContext>();
  const {language}=useLanguage();
  const lang=language||"en";
  const navigate=useNavigate();
  const SK="adbrief_ai_v3";
  const [messages,setMessages]=useState<AIMessage[]>(()=>{try{const s=sessionStorage.getItem(SK);return s?JSON.parse(s):[]}catch{return []}});
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [contextReady,setContextReady]=useState(false);
  const [context,setContext]=useState("");
  const [metaConnected,setMetaConnected]=useState<boolean|null>(null);
  const [connectingMeta,setConnectingMeta]=useState(false);
  const bottomRef=useRef<HTMLDivElement>(null);
  const textareaRef=useRef<HTMLTextAreaElement>(null);

  useEffect(()=>{
    if(!user?.id)return;
    supabase.from("platform_connections" as any).select("platform,status").eq("user_id",user.id).eq("platform","meta").maybeSingle()
      .then(({data})=>setMetaConnected(!!data));
  },[user?.id]);

  const handleConnectMeta=async()=>{
    setConnectingMeta(true);
    try{const{data}=await supabase.functions.invoke("meta-oauth",{body:{action:"get_auth_url",user_id:user.id}});if(data?.url)window.location.href=data.url;}
    catch{setConnectingMeta(false);}
  };

  useEffect(()=>{try{sessionStorage.setItem(SK,JSON.stringify(messages.slice(-30)))}catch{}},[messages]);

  useEffect(()=>{
    if(!user?.id)return;
    (async()=>{
      const[analysesRes,patternsRes,personaRes,entriesRes,savedRes]=await Promise.all([
        supabase.from("analyses").select("id,title,created_at,result,hook_strength,recommended_platforms").eq("user_id",user.id).order("created_at",{ascending:false}).limit(200),
        (supabase as any).from("learned_patterns").select("pattern_key,variables,avg_ctr,avg_cpc,avg_roas,confidence,is_winner,insight_text,sample_size").eq("user_id",user.id).order("confidence",{ascending:false}).limit(50),
        (supabase as any).from("personas").select("name,result").eq("user_id",user.id).eq("is_active",true).single(),
        (supabase as any).from("creative_entries").select("filename,market,editor,platform,creative_type,ctr,roas,spend,clicks,impressions,import_batch_id").eq("user_id",user.id).order("ctr",{ascending:false}).limit(500),
        (supabase as any).from("ai_user_insights").select("summary").eq("user_id",user.id).single(),
      ]);
      const analyses=(analysesRes.data||[]).map((a:any)=>{const r=a.result as Record<string,any>||{};return`[${a.id.slice(0,8)}] ${a.title||"Untitled"} | score:${r.hook_score??"?"} | type:${r.hook_type??"?"} | market:${r.market_guess??"?"} | strength:${a.hook_strength??"?"} | date:${a.created_at?.slice(0,10)}`;}).join("\n");
      const patterns=(patternsRes.data||[]).map((p:any)=>`${p.is_winner?"✓WIN":"✗LOSE"} ${p.pattern_key} | CTR:${p.avg_ctr?.toFixed(3)??"?"} | ROAS:${p.avg_roas?.toFixed(2)??"?"} | conf:${p.confidence} | n:${p.sample_size}`).join("\n");
      const persona=(()=>{if(!personaRes.data)return"No active persona";const r=personaRes.data.result as Record<string,any>||{};return`Name:${personaRes.data.name} | Age:${r.age_range??"?"} | Pain:${(r.pain_points||[]).slice(0,3).join(", ")} | Platforms:${(r.platforms||[]).join("+")}`})();
      const entries=entriesRes.data||[];
      const byEditor:Record<string,{ctr:number[],roas:number[],count:number}>={};
      entries.forEach((e:any)=>{if(e.editor){if(!byEditor[e.editor])byEditor[e.editor]={ctr:[],roas:[],count:0};byEditor[e.editor].count++;if(e.ctr)byEditor[e.editor].ctr.push(e.ctr);if(e.roas)byEditor[e.editor].roas.push(e.roas);}});
      const editorSummary=Object.entries(byEditor).map(([ed,d])=>{const avgCtr=d.ctr.length?(d.ctr.reduce((a,b)=>a+b,0)/d.ctr.length).toFixed(3):"?";const avgRoas=d.roas.length?(d.roas.reduce((a,b)=>a+b,0)/d.roas.length).toFixed(2):"?";return`Editor:${ed} | creatives:${d.count} | avgCTR:${avgCtr} | avgROAS:${avgRoas}`;}).join("\n");
      setContext(`=== ACTIVE PERSONA ===\n${persona}\n\n=== ALL ANALYSES (${(analysesRes.data||[]).length} total) ===\n${analyses||"None yet"}\n\n=== LEARNED PATTERNS ===\n${patterns||"No patterns yet"}\n\n=== EDITOR PERFORMANCE ===\n${editorSummary||"No data"}\n\n=== SAVED INSIGHTS ===\n${savedRes.data?.summary||"None yet"}`);
      setContextReady(true);
    })();
  },[user?.id]);

  const handleNavigate=(route:string,params?:Record<string,string>)=>{if(!params||Object.keys(params).length===0){navigate(route);return;}navigate(`${route}?${new URLSearchParams(params).toString()}`);};

  const send=async(text?:string)=>{
    const msg=(text??input).trim();
    if(!msg||loading||!contextReady)return;
    setInput("");
    if(textareaRef.current)textareaRef.current.style.height="auto";
    setMessages(prev=>[...prev,{role:"user",userText:msg,ts:Date.now()}]);
    setLoading(true);
    try{
      const{data,error}=await supabase.functions.invoke("adbrief-ai-chat",{body:{message:msg,context,user_id:user.id,user_language:lang}});
      if(error||!data?.blocks){
        setMessages(prev=>[...prev,{role:"assistant",blocks:[{type:"warning",title:lang==="pt"?"Não foi possível obter resposta":"Couldn't get a response",content:error?.message||"Try again."}],ts:Date.now()}]);
        return;
      }
      const blocks:Block[]=Array.isArray(data.blocks)?data.blocks:[{type:"insight",title:"Response",content:String(data.blocks)}];
      setMessages(prev=>[...prev,{role:"assistant",blocks,ts:Date.now()}]);
    }catch(e:any){
      setMessages(prev=>[...prev,{role:"assistant",blocks:[{type:"warning",title:"Connection error",content:e?.message||"Network error."}],ts:Date.now()}]);
    }finally{
      setLoading(false);
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),100);
    }
  };

  const handleKey=(e:React.KeyboardEvent)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}};
  const QUICK=[ui(lang,"q1"),ui(lang,"q2"),ui(lang,"q3"),ui(lang,"q4"),ui(lang,"q5"),ui(lang,"q6")];

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#080c14",...j,overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"14px 24px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#0ea5e9,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px rgba(14,165,233,0.2)"}}>
          <Brain size={15} color="#000"/>
        </div>
        <div>
          <p style={{fontSize:14,fontWeight:800,color:"#fff",lineHeight:1}}>{ui(lang,"title")}</p>
          <p style={{...m,fontSize:9.5,color:contextReady?"#34d399":"rgba(255,255,255,0.3)",letterSpacing:"0.1em",marginTop:2}}>
            {contextReady?ui(lang,"ready"):ui(lang,"loading_ctx")}
          </p>
        </div>
        {messages.length>0&&(
          <button onClick={()=>{setMessages([]);sessionStorage.removeItem(SK);}}
            style={{marginLeft:"auto",background:"none",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,cursor:"pointer",color:"rgba(255,255,255,0.3)",display:"flex",alignItems:"center",gap:5,fontSize:11,padding:"5px 10px",...m}}>
            <RotateCcw size={11}/> {ui(lang,"clear")}
          </button>
        )}
      </div>

      {/* Meta banner */}
      {metaConnected===false&&(
        <div style={{margin:"12px 24px 0",padding:"12px 16px",borderRadius:12,background:"rgba(14,165,233,0.07)",border:"1px solid rgba(14,165,233,0.2)",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div style={{flex:1}}>
            <p style={{...j,fontSize:12,fontWeight:700,color:"#fff",marginBottom:2}}>{ui(lang,"connect_title")}</p>
            <p style={{...m,fontSize:11,color:"rgba(255,255,255,0.4)",margin:0}}>{ui(lang,"connect_sub")}</p>
          </div>
          <button onClick={handleConnectMeta} disabled={connectingMeta}
            style={{...j,fontSize:11,fontWeight:700,padding:"8px 16px",borderRadius:9,background:"linear-gradient(135deg,#0ea5e9,#06b6d4)",color:"#000",border:"none",cursor:connectingMeta?"wait":"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            {connectingMeta?<Loader2 size={11} className="animate-spin"/>:null}
            {connectingMeta?ui(lang,"connecting"):ui(lang,"connect_btn")}
          </button>
        </div>
      )}
      {metaConnected===true&&(
        <div style={{margin:"12px 24px 0",padding:"7px 14px",borderRadius:9,background:"rgba(52,211,153,0.05)",border:"1px solid rgba(52,211,153,0.15)",display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:"#34d399",boxShadow:"0 0 5px #34d399"}}/>
          <p style={{...m,fontSize:10.5,color:"rgba(52,211,153,0.75)",margin:0}}>{ui(lang,"connected")}</p>
        </div>
      )}

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"20px 24px 0"}}>
        {messages.length===0&&(
          <div style={{maxWidth:620,margin:"0 auto",paddingTop:16}}>
            <div style={{marginBottom:24,padding:"18px 22px",borderRadius:16,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#0ea5e9,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Brain size={13} color="#000"/>
                </div>
                <p style={{fontSize:13,fontWeight:800,color:"#fff"}}>{ui(lang,"empty_title")}</p>
              </div>
              <p style={{...m,fontSize:12,color:"rgba(255,255,255,0.4)",lineHeight:1.7}}>{ui(lang,"empty_sub")}</p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {QUICK.map(q=>(
                <button key={q} onClick={()=>send(q)}
                  style={{padding:"11px 14px",borderRadius:11,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.6)",fontSize:12,cursor:"pointer",textAlign:"left",...m,lineHeight:1.5,transition:"all 0.15s"}}
                  onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background="rgba(14,165,233,0.07)";el.style.borderColor="rgba(14,165,233,0.2)";el.style.color="#fff";}}
                  onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background="rgba(255,255,255,0.03)";el.style.borderColor="rgba(255,255,255,0.07)";el.style.color="rgba(255,255,255,0.6)";}}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg,i)=>(
          <div key={i} style={{maxWidth:680,margin:"0 auto 20px"}}>
            {msg.role==="user"?(
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:4}}>
                <div style={{padding:"10px 14px",borderRadius:"14px 14px 3px 14px",background:"rgba(14,165,233,0.12)",border:"1px solid rgba(14,165,233,0.2)",fontSize:13,color:"rgba(255,255,255,0.88)",...j,maxWidth:"82%",lineHeight:1.5}}>
                  {msg.userText}
                </div>
              </div>
            ):(
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                  <div style={{width:20,height:20,borderRadius:6,background:"linear-gradient(135deg,#0ea5e9,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Sparkles size={10} color="#000"/>
                  </div>
                  <span style={{...m,fontSize:9.5,color:"rgba(255,255,255,0.2)",letterSpacing:"0.12em",textTransform:"uppercase"}}>ADBRIEF AI</span>
                </div>
                {msg.blocks?.map((b,bi)=><BlockCard key={bi} block={b} onNavigate={handleNavigate} lang={lang}/>)}
              </div>
            )}
          </div>
        ))}
        {loading&&(
          <div style={{maxWidth:680,margin:"0 auto 20px",display:"flex",gap:8,alignItems:"center"}}>
            <div style={{width:20,height:20,borderRadius:6,background:"linear-gradient(135deg,#0ea5e9,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Sparkles size={10} color="#000"/>
            </div>
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              {[0,1,2].map(d=>(
                <div key={d} style={{width:5,height:5,borderRadius:"50%",background:"#0ea5e9",opacity:0.6,animation:`aipulse 1.2s ease-in-out ${d*0.2}s infinite`}}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} style={{height:20}}/>
      </div>

      {/* Input */}
      <div style={{padding:"12px 24px 18px",borderTop:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
        <div style={{maxWidth:680,margin:"0 auto",display:"flex",gap:10,alignItems:"flex-end"}}>
          <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
            placeholder={ui(lang,"placeholder")} rows={1}
            style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:13,padding:"11px 14px",color:"#fff",fontSize:13,resize:"none",outline:"none",...m,lineHeight:1.5,minHeight:43,maxHeight:120}}
            onInput={e=>{const el=e.target as HTMLTextAreaElement;el.style.height="auto";el.style.height=Math.min(el.scrollHeight,120)+"px";}}
            onFocus={e=>{(e.target as HTMLElement).style.borderColor="rgba(14,165,233,0.35)";}}
            onBlur={e=>{(e.target as HTMLElement).style.borderColor="rgba(255,255,255,0.09)";}}
          />
          <button onClick={()=>send()} disabled={!input.trim()||loading||!contextReady}
            style={{width:43,height:43,borderRadius:11,background:input.trim()&&!loading?"linear-gradient(135deg,#0ea5e9,#06b6d4)":"rgba(255,255,255,0.05)",border:"none",cursor:input.trim()&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
            {loading?<Loader2 size={16} color="#0ea5e9" className="animate-spin"/>:<Send size={15} color={input.trim()?"#000":"rgba(255,255,255,0.2)"}/>}
          </button>
        </div>
        <p style={{...m,fontSize:10,color:"rgba(255,255,255,0.15)",textAlign:"center",marginTop:7,letterSpacing:"0.05em"}}>{ui(lang,"footer")}</p>
      </div>
      <style>{`@keyframes aipulse{0%,100%{transform:scale(1);opacity:0.4}50%{transform:scale(1.4);opacity:1}}`}</style>
    </div>
  );
}
