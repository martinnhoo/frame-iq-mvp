// CampaignBuilder v3 — tabs Meta/Google no topo, 5 steps limpos, co-piloto AI
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronRight, ChevronLeft, Check, ExternalLink,
  Target, DollarSign, Users, Megaphone, AlertCircle,
  Loader2, Rocket, Info, AlertTriangle, TrendingUp,
} from "lucide-react";

type Platform = "meta" | "google";
interface Persona { id: string; name: string; result?: any; }
interface AiMsg  { id: string; text: string; type: "tip"|"warn"|"insight"|"ok"; }
interface Form {
  name: string;
  objective: string; optimization_goal: string; cbo: boolean;
  channel_type: string; cpc_bid: string;
  daily_budget: string; country: string;
  age_min: number; age_max: number;
  group_name: string;
  destination_url: string; primary_text: string; headline: string;
}

const META_OBJ = [
  { id:"OUTCOME_TRAFFIC",    label:"Tráfego",       desc:"Cliques no link",        icon:"Traffic" },
  { id:"OUTCOME_LEADS",      label:"Leads",          desc:"Formulário / mensagem",  icon:"Leads" },
  { id:"OUTCOME_SALES",      label:"Vendas",         desc:"Compras e conversões",   icon:"Sales" },
  { id:"OUTCOME_ENGAGEMENT", label:"Engajamento",    desc:"Curtidas e comentários", icon:"Engagement" },
  { id:"OUTCOME_AWARENESS",  label:"Reconhecimento", desc:"Alcance e memória",      icon:"Awareness" },
];
const GOOGLE_CH = [
  { id:"SEARCH",          label:"Search",    desc:"Resultados de busca",         icon:"🔍" },
  { id:"DISPLAY",         label:"Display",   desc:"Banners em sites parceiros",  icon:"🖼️" },
  { id:"VIDEO",           label:"YouTube",   desc:"Anúncios em vídeos",          icon:"▶️" },
  { id:"PERFORMANCE_MAX", label:"Perf. Max", desc:"Todas as redes (automático)", icon:"⚡" },
];
const META_OPT: Record<string,{id:string;label:string}[]> = {
  OUTCOME_TRAFFIC:    [{id:"LINK_CLICKS",label:"Cliques no link"},{id:"LANDING_PAGE_VIEWS",label:"Visualizações de página"}],
  OUTCOME_LEADS:      [{id:"LEAD_GENERATION",label:"Geração de leads"},{id:"CONVERSIONS",label:"Conversões"}],
  OUTCOME_SALES:      [{id:"CONVERSIONS",label:"Conversões"},{id:"VALUE",label:"Valor de conversão"}],
  OUTCOME_ENGAGEMENT: [{id:"POST_ENGAGEMENT",label:"Engajamento"},{id:"VIDEO_VIEWS",label:"Visualizações de vídeo"}],
  OUTCOME_AWARENESS:  [{id:"REACH",label:"Alcance"},{id:"BRAND_AWARENESS",label:"Reconhecimento"}],
};
const COUNTRIES = [
  {id:"BR",label:"Brasil 🇧🇷"},{id:"MX",label:"México 🇲🇽"},{id:"US",label:"EUA 🇺🇸"},
  {id:"AR",label:"Argentina 🇦🇷"},{id:"CO",label:"Colômbia 🇨🇴"},{id:"IN",label:"Índia 🇮🇳"},
];
const STEPS = [
  {label:"Objetivo",  Icon:Target},
  {label:"Orçamento", Icon:DollarSign},
  {label:"Público",   Icon:Users},
  {label:"Criativo",  Icon:Megaphone},
  {label:"Revisar",   Icon:Check},
];

const F="#0e1118",S1="#141824",S2="#1a2135";
const BD="rgba(255,255,255,0.08)",TX="#eef0f6",MT="rgba(255,255,255,0.42)";
const BLUE="#0ea5e9",GREEN="#22c55e",AMBER="#f59e0b",GBLUE="#4285F4";
const pColor=(p:Platform)=>p==="google"?GBLUE:BLUE;

const Label=({children}:{children:React.ReactNode})=>(
  <span style={{fontSize:11,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:8}}>{children}</span>
);

const Toggle=({on,onChange}:{on:boolean;onChange:()=>void})=>(
  <button onClick={onChange} style={{width:42,height:22,borderRadius:11,background:on?BLUE:BD,border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
    <div style={{position:"absolute",top:3,left:on?22:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
  </button>
);

export default function CampaignBuilder() {
  const navigate=useNavigate();
  const [step,setStep]=useState(0);
  const [platform,setPlatform]=useState<Platform>("meta");
  const [personas,setPersonas]=useState<Persona[]>([]);
  const [persona,setPersona]=useState<Persona|null>(null);
  const [userId,setUserId]=useState("");
  const [conns,setConns]=useState<any[]>([]);
  const [connsReady,setConnsReady]=useState(false);
  const [form,setForm]=useState<Form>({
    name:"",objective:"",optimization_goal:"",cbo:false,
    channel_type:"SEARCH",cpc_bid:"1.50",
    daily_budget:"50",country:"BR",age_min:18,age_max:55,
    group_name:"",destination_url:"",primary_text:"",headline:"",
  });
  const [aiMsgs,setAiMsgs]=useState<AiMsg[]>([]);
  const [aiLoading,setAiLoading]=useState(false);
  const [launching,setLaunching]=useState(false);
  const [result,setResult]=useState<any>(null);
  const [error,setError]=useState("");
  const aiRef=useRef<HTMLDivElement>(null);
  const debRef=useRef<ReturnType<typeof setTimeout>>();
  const lastKey=useRef("");

  useEffect(()=>{
    const init = async () => {
      let { data } = await supabase.auth.getSession();
      // Try refresh if session expired
      if (!data.session) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        data = refreshed as any;
      }
      if(!data.session){navigate("/login");return;}
      const uid=data.session.user.id;
      setUserId(uid);
      const{data:ps}=await supabase.from("personas").select("id,name,result").eq("user_id",uid).order("created_at",{ascending:false});
      setPersonas(ps||[]);
      if(ps?.length)setPersona(ps[0]);
    };
    init();
  },[navigate]);

  useEffect(()=>{
    if(!userId||!persona)return;
    setConnsReady(false);
    (supabase as any).from("platform_connections")
      .select("platform,status,ad_accounts,selected_account_id")
      .eq("user_id",userId).eq("persona_id",persona.id).eq("status","active")
      .then(({data}:any)=>{setConns(data||[]);setConnsReady(true);});
  },[userId,persona]);

  useEffect(()=>{if(aiRef.current)aiRef.current.scrollTop=aiRef.current.scrollHeight;},[aiMsgs]);

  const isConnected=(p:Platform)=>conns.some(c=>c.platform===p&&(c.ad_accounts?.length??0)>0);
  const pc=pColor(platform);

  const askAI=useCallback(async(trigger:string,ctx:any)=>{
    if(!userId||!persona)return;
    const key=trigger+JSON.stringify(ctx);
    if(key===lastKey.current)return;
    lastKey.current=key;
    setAiLoading(true);
    try{
      // Call server-side edge function — Anthropic API cannot be called from the browser (CORS)
      const res=await supabase.functions.invoke("campaign-copilot",{
        body:{
          user_id:userId,
          persona_id:persona.id,
          persona_name:persona.name,
          platform,
          trigger,
          form_ctx:ctx,
        },
      });
      const msgs:AiMsg[]=((res.data?.messages)||[])
        .map((m:any)=>({...m,id:Math.random().toString(36).slice(2)}));
      if(msgs.length>0)setAiMsgs(prev=>[...prev.slice(-6),...msgs]);
    }catch{}finally{setAiLoading(false);}
  },[userId,persona,platform]);

  const triggerAI=useCallback((trigger:string,ctx:any)=>{
    clearTimeout(debRef.current);
    debRef.current=setTimeout(()=>askAI(trigger,ctx),800);
  },[askAI]);

  const set=(k:keyof Form,v:any)=>{setForm(f=>({...f,[k]:v}));};

  const canNext=()=>{
    if(step===0)return!!(platform==="meta"?form.objective:form.channel_type)&&!!form.name.trim();
    if(step===1)return!!form.daily_budget&&parseFloat(form.daily_budget)>0;
    if(step===2)return!!form.country;
    return true;
  };

  // billing_event must match optimization_goal
  const billingEvent=(opt:string)=>{
    if(["VALUE","OFFSITE_CONVERSIONS"].includes(opt)) return "IMPRESSIONS";
    if(opt==="LINK_CLICKS") return "LINK_CLICKS";
    return "IMPRESSIONS";
  };

  const launch=async()=>{
    if(!persona||!userId)return;
    setLaunching(true);setError("");
    try{
      const fn=platform==="google"?"create-campaign-google":"create-campaign";
      const optGoal=form.optimization_goal||META_OPT[form.objective]?.[0]?.id||"LINK_CLICKS";
      const body=platform==="meta"
        ?{user_id:userId,persona_id:persona.id,campaign:{
            name:form.name,objective:form.objective,cbo:form.cbo,
            daily_budget:form.daily_budget,
            optimization_goal:optGoal,
            billing_event:billingEvent(optGoal),
            countries:[form.country],age_min:form.age_min,age_max:form.age_max,
            adset_name:form.group_name||`${form.name} — Público 1`,
          }}
        :{user_id:userId,persona_id:persona.id,campaign:{
            name:form.name,channel_type:form.channel_type,
            daily_budget:form.daily_budget,cpc_bid:form.cpc_bid,
            adgroup_name:form.group_name||`${form.name} — Grupo 1`,
          }};
      const res=await supabase.functions.invoke(fn,{body});
      // Handle auth error clearly
      if(res.error?.message?.includes("401")||res.data?.error==="unauthorized"){
        setError("Sessão expirada — recarregue a página e tente novamente.");return;
      }
      if(res.error||res.data?.error){
        setError(res.data?.error||res.error?.message||"Erro ao criar campanha");return;
      }
      setResult({...res.data,platform});
    }catch(e){setError(String(e));}finally{setLaunching(false);}
  };

  const msgSt=(type:string):React.CSSProperties=>{
    const b:React.CSSProperties={padding:"10px 14px",borderRadius:10,fontSize:13,lineHeight:1.55,marginBottom:8,display:"flex",gap:8,alignItems:"flex-start"};
    if(type==="warn")return{...b,background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.2)",color:"#fcd34d"};
    if(type==="insight")return{...b,background:"rgba(14,165,233,0.08)",border:"1px solid rgba(14,165,233,0.18)",color:"#7dd3fc"};
    if(type==="ok")return{...b,background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.18)",color:"#86efac"};
    return{...b,background:"rgba(255,255,255,0.04)",border:`1px solid ${BD}`,color:TX};
  };
  const msgIc=(t:string)=>t==="warn"?"⚠️":t==="insight"?"📊":t==="ok"?"✓":"💡";

  const resetForm=()=>{
    setResult(null);setStep(0);setError("");setAiMsgs([]);
    setForm({name:"",objective:"",optimization_goal:"",cbo:false,channel_type:"SEARCH",cpc_bid:"1.50",daily_budget:"50",country:"BR",age_min:18,age_max:55,group_name:"",destination_url:"",primary_text:"",headline:""});
  };

  if(result){
    const url=result.platform==="google"?result.google_ads_url:result.ads_manager_url;
    return(
      <div style={{minHeight:"100vh",background:F,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif",padding:24}}>
        <div style={{maxWidth:480,width:"100%",textAlign:"center"}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(34,197,94,0.15)",border:"2px solid rgba(34,197,94,0.35)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:28}}>✓</div>
          <h2 style={{fontSize:24,fontWeight:800,color:TX,margin:"0 0 8px"}}>Campanha criada!</h2>
          <p style={{color:MT,fontSize:14,margin:"0 0 28px"}}>Criada como <strong style={{color:"#fcd34d"}}>PAUSADA</strong> — revise no {result.platform==="google"?"Google Ads":"Meta Ads Manager"} antes de ativar.</p>
          <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:12,padding:18,textAlign:"left",marginBottom:20}}>
            <p style={{margin:"0 0 2px",fontSize:11,color:MT,textTransform:"uppercase",letterSpacing:"0.06em"}}>Campaign ID</p>
            <p style={{color:TX,fontSize:13,fontFamily:"monospace",margin:0}}>{result.campaign_id}</p>
          </div>
          <div style={{display:"flex",gap:12}}>
            {url&&<a href={url} target="_blank" rel="noreferrer" style={{flex:1,padding:"12px 0",background:result.platform==="google"?"linear-gradient(135deg,#4285F4,#34A853)":"linear-gradient(135deg,#0ea5e9,#0891b2)",color:"#fff",borderRadius:10,fontWeight:700,fontSize:14,textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><ExternalLink size={14}/>Abrir no {result.platform==="google"?"Google Ads":"Meta Ads"}</a>}
            <button onClick={resetForm} style={{flex:1,padding:"12px 0",background:S2,color:TX,border:`1px solid ${BD}`,borderRadius:10,fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',system-ui,sans-serif"}}>Nova campanha</button>
          </div>
        </div>
      </div>
    );
  }

  const BG="#0e1118";
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(180deg,#060a12 0%,#04060a 100%)",fontFamily:"'DM Sans',system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .cbi{background:${S2};border:1px solid ${BD};border-radius:10px;color:${TX};font-family:'DM Sans',system-ui,sans-serif;font-size:14px;padding:11px 14px;width:100%;box-sizing:border-box;outline:none;transition:border-color 0.15s;}
        .cbi:focus{border-color:${BLUE};}
        .cbi::placeholder{color:${MT};}
        .obj-card{background:${S1};border:1.5px solid ${BD};border-radius:12px;padding:16px 18px;cursor:pointer;transition:all 0.15s;}
        .obj-card:hover{border-color:rgba(255,255,255,0.18);}
        .pill{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;border:1.5px solid ${BD};background:${S2};color:${TX};cursor:pointer;font-family:'DM Sans',system-ui,sans-serif;transition:all 0.15s;}
      `}</style>

      {/* Header */}
      <div style={{padding:"14px 24px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"center",gap:14}}>
        <button onClick={()=>navigate("/dashboard/performance")} style={{background:"none",border:"none",color:MT,cursor:"pointer",display:"flex",padding:4}}><ChevronLeft size={20}/></button>
        <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${pc},${platform==="google"?"#34A853":"#06b6d4"})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Rocket size={14} color="#fff"/></div>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:15,fontWeight:700,color:TX}}>Criar campanha</p>
          <p style={{margin:0,fontSize:12,color:MT}}>Co-piloto AI ativo — {platform==="meta"?"Meta Ads":"Google Ads"}</p>
        </div>
        {personas.length>1&&(
          <select value={persona?.id||""} onChange={e=>setPersona(personas.find(p=>p.id===e.target.value)||null)}
            className="cbi" style={{width:"auto",fontSize:13,padding:"7px 12px"}}>
            {personas.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {personas.length===1&&persona&&<span style={{fontSize:13,color:MT}}>{persona.name}</span>}
      </div>

      {/* Platform tabs */}
      <div style={{padding:"0 24px",borderBottom:`1px solid ${BD}`,display:"flex",gap:0}}>
        {([
          {id:"meta" as Platform,label:"Meta Ads",  glyph:"meta",grad:"linear-gradient(135deg,#0ea5e9,#06b6d4)",color:BLUE},
          {id:"google" as Platform,label:"Google Ads",glyph:"google",grad:"linear-gradient(135deg,#4285F4,#34A853)",color:GBLUE},
        ]).map(plt=>{
          const active=platform===plt.id;
          const connected=connsReady&&isConnected(plt.id);
          return(
            <button key={plt.id} onClick={()=>{
                setPlatform(plt.id);
                setStep(0);
                setAiMsgs([]);
                setError("");
                setForm(f=>({...f, objective:"", optimization_goal:"", channel_type:"SEARCH"}));
              }}
              style={{display:"flex",alignItems:"center",gap:9,padding:"13px 20px",border:"none",borderBottom:`2px solid ${active?plt.color:"transparent"}`,background:"transparent",cursor:"pointer",fontFamily:"'DM Sans',system-ui,sans-serif",color:active?plt.color:MT,fontWeight:active?700:500,fontSize:14,transition:"all 0.15s"}}>
              {plt.glyph === "meta" ? (
                <div style={{width:20,height:20,borderRadius:5,background:active?plt.grad:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s"}}>
                  <svg width="12" height="7" viewBox="0 0 36 18" fill="none"><path d="M8.5 0C5.5 0 3.2 1.6 1.6 3.8.6 5.2 0 7 0 9c0 2 .6 3.8 1.6 5.2C3.2 16.4 5.5 18 8.5 18c2.2 0 4-.9 5.5-2.4L18 12l4 3.6C23.5 17.1 25.3 18 27.5 18c3 0 5.3-1.6 6.9-3.8 1-1.4 1.6-3.2 1.6-5.2 0-2-.6-3.8-1.6-5.2C32.8 1.6 30.5 0 27.5 0c-2.2 0-4 .9-5.5 2.4L18 6l-4-3.6C12.5.9 10.7 0 8.5 0zm0 4c1.2 0 2.2.5 3.2 1.4L15 8.9 11.7 12.6C10.7 13.5 9.7 14 8.5 14c-1.6 0-2.9-.8-3.8-2C4 11 3.6 10 3.6 9s.4-2 1.1-3C5.6 4.8 6.9 4 8.5 4zm19 0c1.6 0 2.9.8 3.8 2 .7 1 1.1 2 1.1 3s-.4 2-1.1 3c-.9 1.2-2.2 2-3.8 2-1.2 0-2.2-.5-3.2-1.4L21 9.1l3.3-3.7C25.3 4.5 26.3 4 27.5 4z" fill="#fff"/></svg>
                </div>
              ) : (
                <div style={{width:20,height:20,borderRadius:5,background:active?plt.grad:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s"}}>
                  <svg width="12" height="12" viewBox="0 0 48 48"><path fill="#fff" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"/></svg>
                </div>
              )}
              {plt.label}
              <div style={{width:6,height:6,borderRadius:"50%",background:!connsReady?MT:connected?GREEN:AMBER,flexShrink:0}} title={!connsReady?"Verificando...":connected?"Conectado":"Não conectado"}/>
            </button>
          );
        })}
      </div>

      {/* Not connected warning */}
      {connsReady&&!isConnected(platform)&&(
        <div style={{padding:"10px 24px",background:"rgba(245,158,11,0.06)",borderBottom:"1px solid rgba(245,158,11,0.14)",display:"flex",alignItems:"center",gap:8}}>
          <AlertTriangle size={13} color={AMBER} style={{flexShrink:0}}/>
          <p style={{margin:0,fontSize:13,color:AMBER}}>
            {platform==="meta"?"Meta Ads":"Google Ads"} não conectado.{" "}
            <button onClick={()=>navigate("/dashboard/accounts")} style={{background:"none",border:"none",color:AMBER,cursor:"pointer",fontWeight:700,fontSize:13,padding:0,fontFamily:"'DM Sans',system-ui,sans-serif",textDecoration:"underline"}}>Conectar</button>
          </p>
        </div>
      )}

      {/* Steps */}
      <div style={{padding:"12px 24px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"center",overflowX:"auto"}}>
        {STEPS.map(({label,Icon},i)=>{
          const active=i===step,done=i<step;
          return(
            <React.Fragment key={label}>
              <div onClick={()=>done&&setStep(i)} style={{display:"flex",alignItems:"center",gap:7,cursor:done?"pointer":"default",opacity:active||done?1:0.35,flexShrink:0}}>
                <div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:done?"rgba(34,197,94,0.15)":active?`${pc}18`:S2,border:`1.5px solid ${done?"rgba(34,197,94,0.4)":active?pc:BD}`,transition:"all 0.2s"}}>
                  {done?<Check size={11} color="#86efac"/>:<Icon size={11} color={active?pc:MT}/>}
                </div>
                <span style={{fontSize:12,fontWeight:active?600:400,color:active?TX:MT,whiteSpace:"nowrap"}}>{label}</span>
              </div>
              {i<STEPS.length-1&&<div style={{flex:1,height:1,background:i<step?"rgba(34,197,94,0.2)":BD,margin:"0 10px",minWidth:16}}/>}
            </React.Fragment>
          );
        })}
      </div>

      {/* Body */}
      <div className="campaign-body" style={{flex:1,display:"flex",overflow:"hidden"}}>

        {/* Form */}
        <div style={{flex:1,padding:"28px 32px",overflowY:"auto",animation:"fadeUp 0.2s ease",minWidth:0,background:"transparent"}} key={`${platform}-${step}`}>

          {/* STEP 0: Objetivo */}
          {step===0&&(
            <div>
              <h2 style={{fontSize:20,fontWeight:800,color:TX,margin:"0 0 4px"}}>{platform==="meta"?"Objetivo da campanha":"Tipo de campanha"}</h2>
              <p style={{color:MT,fontSize:14,margin:"0 0 22px"}}>{platform==="meta"?"O que você quer alcançar?":"Qual rede você quer usar?"}</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10,marginBottom:22}}>
                {(platform==="meta"?META_OBJ:GOOGLE_CH).map(obj=>{
                  const sel=platform==="meta"?form.objective===obj.id:form.channel_type===obj.id;
                  return(
                    <div key={obj.id} className="obj-card"
                      style={{borderColor:sel?pc:BD,background:sel?`${pc}10`:S1}}
                      onClick={()=>{
                        if(platform==="meta"){set("objective",obj.id);set("optimization_goal",META_OPT[obj.id]?.[0]?.id||"");}
                        else set("channel_type",obj.id);
                        triggerAI("objetivo",{objective:obj.id,channel_type:obj.id,platform});
                      }}>
                      {obj.icon === "Traffic" ? (
                        <div style={{marginBottom:8,display:"flex",justifyContent:"center"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg></div>
                      ) : obj.icon === "Leads" ? (
                        <div style={{marginBottom:8,display:"flex",justifyContent:"center"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
                      ) : obj.icon === "Sales" ? (
                        <div style={{marginBottom:8,display:"flex",justifyContent:"center"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></div>
                      ) : obj.icon === "Engagement" ? (
                        <div style={{marginBottom:8,display:"flex",justifyContent:"center"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
                      ) : (
                        <div style={{marginBottom:8,display:"flex",justifyContent:"center"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
                      )}
                      <p style={{margin:"0 0 3px",fontSize:13,fontWeight:700,color:TX}}>{obj.label}</p>
                      <p style={{margin:0,fontSize:12,color:MT}}>{obj.desc}</p>
                    </div>
                  );
                })}
              </div>
              {platform==="meta"&&META_OPT[form.objective]&&(
                <div style={{marginBottom:20}}>
                  <Label>Meta de otimização</Label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {META_OPT[form.objective].map(g=>(
                      <button key={g.id} className="pill"
                        style={{borderColor:form.optimization_goal===g.id?pc:BD,background:form.optimization_goal===g.id?`${pc}12`:S2,color:form.optimization_goal===g.id?pc:TX}}
                        onClick={()=>set("optimization_goal",g.id)}>{g.label}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label>Nome da campanha *</Label>
                <input className="cbi" placeholder="ex: Leads Q2 — Público Frio" value={form.name}
                  onChange={e=>{set("name",e.target.value);triggerAI("nome",{name:e.target.value,platform});}}/>
                {(platform==="meta"?form.objective:form.channel_type)&&!form.name.trim()&&(
                  <p style={{fontSize:12,color:AMBER,margin:"6px 0 0"}}>⚠ Preencha o nome para continuar</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 1: Orçamento */}
          {step===1&&(
            <div>
              <h2 style={{fontSize:20,fontWeight:800,color:TX,margin:"0 0 4px"}}>Orçamento diário</h2>
              <p style={{color:MT,fontSize:14,margin:"0 0 22px"}}>{platform==="meta"?"Mín. R$50/dia para sair da fase de aprendizado em ~7 dias.":"Recomendado: pelo menos 10× o CPC médio esperado."}</p>
              <div style={{marginBottom:20}}>
                <Label>Valor diário (R$) *</Label>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:MT,fontSize:14,pointerEvents:"none"}}>R$</span>
                  <input className="cbi" style={{paddingLeft:36}} type="number" min="5" step="5" value={form.daily_budget}
                    onChange={e=>{set("daily_budget",e.target.value);triggerAI("orcamento",{daily_budget:e.target.value,platform});}}/>
                </div>
              </div>
              {platform==="meta"&&(
                <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:12,padding:"16px 20px",marginBottom:20}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <p style={{margin:"0 0 3px",fontSize:14,fontWeight:600,color:TX}}>CBO — Otimização de orçamento</p>
                      <p style={{margin:0,fontSize:12,color:MT}}>Meta distribui automaticamente entre os conjuntos.</p>
                    </div>
                    <Toggle on={form.cbo} onChange={()=>{const n=!form.cbo;set("cbo",n);triggerAI("cbo",{cbo:n});}}/>
                  </div>
                </div>
              )}
              {platform==="google"&&(
                <div style={{marginBottom:20}}>
                  <Label>CPC máximo (R$)</Label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:MT,fontSize:14,pointerEvents:"none"}}>R$</span>
                    <input className="cbi" style={{paddingLeft:36}} type="number" min="0.10" step="0.10" value={form.cpc_bid}
                      onChange={e=>{set("cpc_bid",e.target.value);triggerAI("cpc",{cpc_bid:e.target.value});}}/>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Público */}
          {step===2&&(
            <div>
              <h2 style={{fontSize:20,fontWeight:800,color:TX,margin:"0 0 4px"}}>{platform==="meta"?"Público":"Segmentação"}</h2>
              <p style={{color:MT,fontSize:14,margin:"0 0 22px"}}>{platform==="meta"?"Defina quem vai ver seus anúncios.":"Segmentação detalhada é feita no Google Ads após a criação."}</p>
              <div style={{marginBottom:20}}>
                <Label>País</Label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {COUNTRIES.map(c=>(
                    <button key={c.id} className="pill"
                      style={{borderColor:form.country===c.id?pc:BD,background:form.country===c.id?`${pc}12`:S2,color:form.country===c.id?pc:TX}}
                      onClick={()=>{set("country",c.id);triggerAI("pais",{country:c.id,platform});}}>{c.label}</button>
                  ))}
                </div>
              </div>
              {platform==="meta"&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
                  <div>
                    <Label>Idade mínima</Label>
                    <input className="cbi" type="number" min={18} max={65} value={form.age_min}
                      onChange={e=>{set("age_min",parseInt(e.target.value));triggerAI("idade",{age_min:parseInt(e.target.value),age_max:form.age_max});}}/>
                  </div>
                  <div>
                    <Label>Idade máxima</Label>
                    <input className="cbi" type="number" min={18} max={65} value={form.age_max}
                      onChange={e=>{set("age_max",parseInt(e.target.value));triggerAI("idade",{age_min:form.age_min,age_max:parseInt(e.target.value)});}}/>
                  </div>
                </div>
              )}
              <div>
                <Label>{platform==="meta"?"Nome do conjunto de anúncios":"Nome do grupo de anúncios"}</Label>
                <input className="cbi" placeholder={`${form.name||"Campanha"} — ${platform==="meta"?"Público 1":"Grupo 1"}`}
                  value={form.group_name} onChange={e=>set("group_name",e.target.value)}/>
                <p style={{fontSize:12,color:MT,margin:"6px 0 0"}}>Opcional — deixe em branco para usar o nome padrão.</p>
              </div>
              {platform==="google"&&(
                <div style={{marginTop:18,display:"flex",gap:10,padding:"12px 16px",background:"rgba(66,133,244,0.07)",border:"1px solid rgba(66,133,244,0.18)",borderRadius:10}}>
                  <Info size={14} color={GBLUE} style={{flexShrink:0,marginTop:1}}/>
                  <p style={{margin:0,fontSize:13,color:"#93c5fd"}}>Palavras-chave, interesses e audiências são configurados no Google Ads após a criação.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Criativo */}
          {step===3&&(
            <div>
              <h2 style={{fontSize:20,fontWeight:800,color:TX,margin:"0 0 4px"}}>Criativo</h2>
              <div style={{display:"flex",gap:10,padding:"10px 14px",background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.18)",borderRadius:10,marginBottom:20}}>
                <Info size={14} color={AMBER} style={{flexShrink:0,marginTop:1}}/>
                <p style={{margin:0,fontSize:13,color:AMBER}}>Campanha criada <strong>pausada</strong>. Adicione o criativo {platform==="meta"?"no Meta Ads Manager":"no Google Ads"} antes de ativar.</p>
              </div>
              <div style={{marginBottom:18}}>
                <Label>Texto principal</Label>
                <textarea className="cbi" rows={4} style={{resize:"vertical"}}
                  placeholder={platform==="meta"?"Copy do anúncio — o primeiro parágrafo é o mais importante":"Descrição do anúncio"}
                  value={form.primary_text}
                  onChange={e=>{set("primary_text",e.target.value);if(e.target.value.length>20)triggerAI("copy",{primary_text:e.target.value,platform});}}/>
              </div>
              <div style={{marginBottom:18}}>
                <Label>Headline</Label>
                <input className="cbi" placeholder={platform==="meta"?"Título (máx 40 chars)":"Título (máx 30 chars)"}
                  value={form.headline} maxLength={platform==="meta"?40:30}
                  onChange={e=>{set("headline",e.target.value);triggerAI("headline",{headline:e.target.value,platform});}}/>
                <p style={{fontSize:12,color:form.headline.length>(platform==="meta"?35:25)?AMBER:MT,margin:"4px 0 0",textAlign:"right"}}>{form.headline.length}/{platform==="meta"?40:30}</p>
              </div>
              <div>
                <Label>URL de destino</Label>
                <input className="cbi" placeholder="https://..." value={form.destination_url}
                  onChange={e=>{set("destination_url",e.target.value);if(e.target.value.startsWith("http"))triggerAI("url",{destination_url:e.target.value,platform});}}/>
              </div>
            </div>
          )}

          {/* STEP 4: Revisar */}
          {step===4&&(
            <div>
              <h2 style={{fontSize:20,fontWeight:800,color:TX,margin:"0 0 4px"}}>Revisar e criar</h2>
              <p style={{color:MT,fontSize:14,margin:"0 0 22px"}}>Campanha criada <strong style={{color:"#fcd34d"}}>pausada</strong>. Ative após revisar na plataforma.</p>
              {error&&(
                <div style={{display:"flex",gap:10,padding:"12px 16px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,marginBottom:20}}>
                  <AlertCircle size={15} color="#f87171" style={{flexShrink:0,marginTop:1}}/>
                  <p style={{margin:0,fontSize:13,color:"#f87171"}}>{error}</p>
                </div>
              )}
              <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"5px 14px",background:`${pc}10`,border:`1px solid ${pc}28`,borderRadius:20,marginBottom:20}}>
                <span style={{fontSize:12,fontWeight:700,color:pc}}>{platform==="google"?"Google Ads":"Meta Ads"}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
                {[
                  {label:"Nome",value:form.name},
                  {label:platform==="meta"?"Objetivo":"Tipo",value:platform==="meta"?META_OBJ.find(o=>o.id===form.objective)?.label:GOOGLE_CH.find(c=>c.id===form.channel_type)?.label},
                  {label:"Orçamento diário",value:`R$ ${form.daily_budget}${platform==="meta"&&form.cbo?" (CBO)":""}`},
                  {label:"País",value:COUNTRIES.find(c=>c.id===form.country)?.label},
                  ...(platform==="meta"?[{label:"Faixa etária",value:`${form.age_min}–${form.age_max} anos`}]:[]),
                  ...(platform==="google"?[{label:"CPC máximo",value:`R$ ${form.cpc_bid}`}]:[]),
                ].map(row=>(
                  <div key={row.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:S1,border:`1px solid ${BD}`,borderRadius:10}}>
                    <span style={{fontSize:13,color:MT}}>{row.label}</span>
                    <span style={{fontSize:13,fontWeight:600,color:TX}}>{row.value||"—"}</span>
                  </div>
                ))}
              </div>
              <button 
                onClick={launch} 
                disabled={launching || !connsReady || !isConnected(platform)}
                style={{
                  width:"100%", padding:"14px 0",
                  background: (!connsReady || !isConnected(platform) || launching)
                    ? S2
                    : platform==="google"
                      ? "linear-gradient(135deg,#4285F4,#34A853)"
                      : "linear-gradient(135deg,#0ea5e9,#0891b2)",
                  color: (!connsReady || !isConnected(platform)) ? MT : "#fff",
                  borderRadius:12, fontWeight:700, fontSize:15, border:"none",
                  cursor: (connsReady && isConnected(platform) && !launching) ? "pointer" : "not-allowed",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  fontFamily:"'DM Sans',system-ui,sans-serif", transition:"all 0.15s",
                }}>
                {launching
                  ? <><Loader2 size={17} style={{animation:"spin 1s linear infinite"}}/>Criando...</>
                  : !connsReady
                    ? <><Loader2 size={17} style={{animation:"spin 1s linear infinite"}}/>Verificando conexão...</>
                    : <><Rocket size={17}/>Criar campanha pausada</>
                }
              </button>
              {connsReady&&!isConnected(platform)&&(
                <p style={{textAlign:"center",color:AMBER,fontSize:13,margin:"12px 0 0"}}>
                  Conecte o {platform==="meta"?"Meta Ads":"Google Ads"} em{" "}
                  <button onClick={()=>navigate("/dashboard/accounts")} style={{background:"none",border:"none",color:AMBER,cursor:"pointer",fontWeight:700,fontSize:13,padding:0,fontFamily:"'DM Sans',system-ui,sans-serif",textDecoration:"underline"}}>Accounts</button>{" "}para criar campanhas.
                </p>
              )}
            </div>
          )}

          {/* Nav buttons */}
          {step<4&&(
            <div style={{display:"flex",gap:12,marginTop:32}}>
              {step>0&&(
                <button onClick={()=>setStep(s=>s-1)}
                  style={{padding:"11px 20px",background:S2,color:TX,border:`1px solid ${BD}`,borderRadius:10,fontWeight:600,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
                  <ChevronLeft size={15}/>Voltar
                </button>
              )}
              <button onClick={()=>setStep(s=>s+1)} disabled={!canNext()}
                style={{flex:1,padding:"11px 0",background:canNext()?pc:S2,color:canNext()?"#fff":MT,borderRadius:10,fontWeight:700,fontSize:14,border:"none",cursor:canNext()?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.15s",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
                Continuar<ChevronRight size={15}/>
              </button>
            </div>
          )}
        </div>

        {/* AI Panel */}
        <div className="campaign-ai-panel" style={{width:290,borderLeft:"1px solid rgba(255,255,255,0.06)",background:"linear-gradient(180deg,rgba(14,165,233,0.04) 0%,rgba(255,255,255,0.02) 100%)",display:"flex",flexDirection:"column",flexShrink:0,boxShadow:"inset 4px 0 16px rgba(0,0,0,0.3)"}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:aiLoading?pc:GREEN,animation:aiLoading?"pulse 1s infinite":"none"}}/>
            <p style={{margin:0,fontSize:13,fontWeight:600,color:TX}}>Co-piloto IA</p>
            <span style={{marginLeft:"auto",fontSize:11,color:MT}}>Dados reais</span>
          </div>
          <div ref={aiRef} style={{flex:1,overflowY:"auto",padding:14}}>
            {aiMsgs.length===0&&!aiLoading&&(
              <div style={{textAlign:"center",padding:"32px 14px"}}>
                <div style={{fontSize:28,marginBottom:10}}>🧠</div>
                <p style={{color:MT,fontSize:13,margin:0,lineHeight:1.7}}>Preencha os campos e o co-piloto vai comentar com base nos dados da sua conta.</p>
              </div>
            )}
            {aiMsgs.map(msg=>(
              <div key={msg.id} style={{...msgSt(msg.type),animation:"fadeUp 0.25s ease"}}>
                <span style={{flexShrink:0}}>{msgIc(msg.type)}</span>
                <span>{msg.text}</span>
              </div>
            ))}
            {aiLoading&&(
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:`${pc}08`,border:`1px solid ${pc}18`,borderRadius:10}}>
                {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:pc,animation:`pulse 1.2s ${i*0.2}s infinite`}}/>)}
                <span style={{fontSize:12,color:MT,marginLeft:4}}>Analisando...</span>
              </div>
            )}
          </div>
          <div style={{padding:"10px 14px",borderTop:`1px solid ${BD}`}}>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <TrendingUp size={11} color={MT}/>
              <p style={{margin:0,fontSize:11,color:MT}}>{persona?persona.name:"Selecione uma conta"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
