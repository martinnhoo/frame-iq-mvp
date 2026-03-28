// CampaignBuilder v2 — Meta + Google Ads, co-piloto AI, verificação de conexão
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ChevronLeft, Check, ExternalLink, Target, DollarSign, Users, Megaphone, AlertCircle, TrendingUp, Loader2, Rocket, Info, Link2, AlertTriangle, CheckCircle2 } from "lucide-react";

type Platform = "meta" | "google";
interface Persona { id: string; name: string; result?: any; }
interface AiMsg { id: string; text: string; type: "tip"|"warn"|"insight"|"ok"; }
interface Form {
  name: string; objective: string; optimization_goal: string; cbo: boolean;
  channel_type: string; cpc_bid: string;
  daily_budget: string; country: string; age_min: number; age_max: number;
  adset_name: string; destination_url: string; primary_text: string; headline: string;
}

const META_OBJECTIVES = [
  { id:"OUTCOME_TRAFFIC",    label:"Tráfego",       desc:"Cliques no link",         icon:"🌐" },
  { id:"OUTCOME_LEADS",      label:"Leads",          desc:"Formulário / mensagem",   icon:"📋" },
  { id:"OUTCOME_SALES",      label:"Vendas",         desc:"Compras e conversões",    icon:"💰" },
  { id:"OUTCOME_ENGAGEMENT", label:"Engajamento",    desc:"Curtidas e comentários",  icon:"❤️" },
  { id:"OUTCOME_AWARENESS",  label:"Reconhecimento", desc:"Alcance e memória",       icon:"📢" },
];
const GOOGLE_CHANNELS = [
  { id:"SEARCH",           label:"Search",          desc:"Resultados de busca",           icon:"🔍" },
  { id:"DISPLAY",          label:"Display",         desc:"Banners em sites parceiros",     icon:"🖼️" },
  { id:"VIDEO",            label:"YouTube",         desc:"Anúncios em vídeos",            icon:"▶️" },
  { id:"PERFORMANCE_MAX",  label:"Performance Max", desc:"Todas as redes (automático)",   icon:"⚡" },
];
const META_OPT: Record<string,{id:string;label:string}[]> = {
  OUTCOME_TRAFFIC:    [{id:"LINK_CLICKS",label:"Cliques no link"},{id:"LANDING_PAGE_VIEWS",label:"Visualizações de página"}],
  OUTCOME_LEADS:      [{id:"LEAD_GENERATION",label:"Geração de leads"},{id:"CONVERSIONS",label:"Conversões"}],
  OUTCOME_SALES:      [{id:"CONVERSIONS",label:"Conversões"},{id:"VALUE",label:"Valor de conversão"}],
  OUTCOME_ENGAGEMENT: [{id:"POST_ENGAGEMENT",label:"Engajamento no post"},{id:"VIDEO_VIEWS",label:"Visualizações de vídeo"}],
  OUTCOME_AWARENESS:  [{id:"REACH",label:"Alcance"},{id:"BRAND_AWARENESS",label:"Reconhecimento"}],
};
const COUNTRIES = [
  {id:"BR",label:"Brasil 🇧🇷"},{id:"MX",label:"México 🇲🇽"},{id:"US",label:"EUA 🇺🇸"},
  {id:"AR",label:"Argentina 🇦🇷"},{id:"CO",label:"Colômbia 🇨🇴"},{id:"IN",label:"Índia 🇮🇳"},
];
const STEP_LABELS = ["Plataforma","Objetivo","Orçamento","Público","Criativo","Revisar"];
const STEP_ICONS  = [Link2, Target, DollarSign, Users, Megaphone, Check];

const F = "'DM Sans',system-ui,sans-serif";
const BG="#0e1118",S1="#141824",S2="#1a2135",BD="rgba(255,255,255,0.08)",TX="#eef0f6",MT="rgba(255,255,255,0.42)";
const PRIMARY="#0ea5e9",GREEN="#22c55e",RED="#ef4444",AMBER="#f59e0b",GBLUE="#4285F4";

export default function CampaignBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [platform, setPlatform] = useState<Platform|null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [persona, setPersona] = useState<Persona|null>(null);
  const [userId, setUserId] = useState("");
  const [conns, setConns] = useState<any[]>([]);
  const [connsLoading, setConnsLoading] = useState(true);
  const [form, setForm] = useState<Form>({
    name:"",objective:"",optimization_goal:"",cbo:false,
    channel_type:"SEARCH",cpc_bid:"1.50",
    daily_budget:"50",country:"BR",age_min:18,age_max:55,
    adset_name:"",destination_url:"",primary_text:"",headline:"",
  });
  const [aiMsgs, setAiMsgs] = useState<AiMsg[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const aiRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const lastKey = useRef("");

  useEffect(() => {
    supabase.auth.getSession().then(async({data}) => {
      if(!data.session){navigate("/login");return;}
      const uid = data.session.user.id;
      setUserId(uid);
      const [{data:ps}] = await Promise.all([
        supabase.from("personas").select("id,name,result").eq("user_id",uid).order("created_at",{ascending:false}),
      ]);
      setPersonas(ps||[]);
      if(ps?.length) setPersona(ps[0]);
    });
  },[navigate]);

  useEffect(() => {
    if(!userId||!persona) return;
    setConnsLoading(true);
    (supabase as any).from("platform_connections")
      .select("platform,status,ad_accounts,selected_account_id")
      .eq("user_id",userId).eq("persona_id",persona.id).eq("status","active")
      .then(({data}:any)=>{setConns(data||[]);setConnsLoading(false);});
  },[userId,persona]);

  useEffect(()=>{if(aiRef.current)aiRef.current.scrollTop=aiRef.current.scrollHeight;},[aiMsgs]);

  const isConnected = (plt:Platform) => conns.some(c=>c.platform===plt&&(c.ad_accounts?.length??0)>0);

  const askAI = useCallback(async(trigger:string,ctx:any)=>{
    if(!userId||!persona)return;
    const key=trigger+JSON.stringify(ctx);
    if(key===lastKey.current)return;
    lastKey.current=key;
    setAiLoading(true);
    try{
      const {data:snap} = await (supabase as any).from("daily_snapshots")
        .select("total_spend,avg_ctr,active_ads,ai_insight")
        .eq("user_id",userId).eq("persona_id",persona.id)
        .order("date",{ascending:false}).limit(1).maybeSingle();
      const {data:pats} = await (supabase as any).from("learned_patterns")
        .select("insight_text,avg_ctr,is_winner").eq("user_id",userId)
        .order("confidence",{ascending:false}).limit(6);
      const acctCtx = snap
        ? `CTR: ${((snap.avg_ctr||0)*100).toFixed(2)}% | Spend: R$${(snap.total_spend||0).toFixed(0)} | Ads: ${snap.active_ads||0}`
        : "Sem histórico ainda.";
      const patsCtx = (pats||[]).filter((p:any)=>p.insight_text)
        .map((p:any)=>`${p.is_winner?"✓":"✗"} ${p.insight_text} (CTR ${((p.avg_ctr||0)*100).toFixed(2)}%)`).join("\n");
      const r = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:400,messages:[{role:"user",content:
          `Co-piloto de campanha AdBrief. Plataforma: ${ctx.platform||platform}. Conta: ${persona.name}.\nDados: ${acctCtx}\n${patsCtx?`Padrões:\n${patsCtx}`:""}\nEtapa: ${trigger}\nFormulário: ${JSON.stringify(ctx)}\n1-3 comentários curtos. JSON: [{"type":"tip"|"warn"|"insight"|"ok","text":"..."}] Só JSON.`
        }]}),
      });
      const d = await r.json();
      const msgs:AiMsg[] = JSON.parse((d.content?.[0]?.text||"[]").replace(/```json|```/g,"").trim())
        .map((m:any)=>({...m,id:Math.random().toString(36).slice(2)}));
      setAiMsgs(prev=>[...prev.slice(-6),...msgs]);
    }catch{}finally{setAiLoading(false);}
  },[userId,persona,platform]);

  const triggerAI = useCallback((trigger:string,ctx:any)=>{
    clearTimeout(debounceRef.current);
    debounceRef.current=setTimeout(()=>askAI(trigger,ctx),800);
  },[askAI]);

  const set = (k:keyof Form,v:any)=>setForm(f=>({...f,[k]:v}));
  const pColor = platform==="google"?GBLUE:PRIMARY;

  const canNext=()=>{
    if(step===0)return!!platform&&isConnected(platform);
    if(step===1)return!!(platform==="meta"?form.objective:form.channel_type)&&!!form.name;
    if(step===2)return!!form.daily_budget&&parseFloat(form.daily_budget)>0;
    if(step===3)return!!form.country;
    return true;
  };

  const launch=async()=>{
    if(!persona||!userId||!platform)return;
    setLaunching(true);setError("");
    try{
      const fnName=platform==="google"?"create-campaign-google":"create-campaign";
      const payload=platform==="meta"
        ?{user_id:userId,persona_id:persona.id,campaign:{name:form.name,objective:form.objective,cbo:form.cbo,daily_budget:form.daily_budget,optimization_goal:form.optimization_goal||META_OPT[form.objective]?.[0]?.id,countries:[form.country],age_min:form.age_min,age_max:form.age_max,adset_name:form.adset_name||`${form.name} — Público 1`}}
        :{user_id:userId,persona_id:persona.id,campaign:{name:form.name,channel_type:form.channel_type,daily_budget:form.daily_budget,cpc_bid:form.cpc_bid,adgroup_name:form.adset_name||`${form.name} — Grupo 1`}};
      const res=await supabase.functions.invoke(fnName,{body:payload});
      if(res.error||res.data?.error){setError(res.data?.error||res.error?.message||"Erro");return;}
      setResult({...res.data,platform});
    }catch(e){setError(String(e));}finally{setLaunching(false);}
  };

  const msgSt=(type:string):React.CSSProperties=>{
    const b:React.CSSProperties={padding:"10px 14px",borderRadius:10,fontSize:13,lineHeight:1.5,marginBottom:8,display:"flex",gap:8,alignItems:"flex-start"};
    if(type==="warn")return{...b,background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.25)",color:"#fcd34d"};
    if(type==="insight")return{...b,background:"rgba(14,165,233,0.1)",border:"1px solid rgba(14,165,233,0.2)",color:"#7dd3fc"};
    if(type==="ok")return{...b,background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.2)",color:"#86efac"};
    return{...b,background:"rgba(255,255,255,0.05)",border:`1px solid ${BD}`,color:TX};
  };
  const msgIc=(t:string)=>t==="warn"?"⚠️":t==="insight"?"📊":t==="ok"?"✓":"💡";

  if(result){
    const url=result.platform==="google"?result.google_ads_url:result.ads_manager_url;
    return(
      <div style={{minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F,padding:24}}>
        <div style={{maxWidth:520,width:"100%",textAlign:"center"}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:"rgba(34,197,94,0.15)",border:"2px solid rgba(34,197,94,0.4)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px",fontSize:32}}>✓</div>
          <h1 style={{fontSize:28,fontWeight:800,color:TX,margin:"0 0 8px"}}>Campanha criada!</h1>
          <p style={{color:MT,fontSize:15,margin:"0 0 32px"}}>Criada como <strong style={{color:"#fcd34d"}}>PAUSADA</strong>. Revise antes de ativar.</p>
          <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:12,padding:20,textAlign:"left",marginBottom:24}}>
            <p style={{margin:"0 0 2px",fontSize:11,color:MT,textTransform:"uppercase",letterSpacing:"0.06em"}}>Campaign ID</p>
            <p style={{color:TX,fontSize:13,fontFamily:"monospace",margin:0}}>{result.campaign_id}</p>
          </div>
          <div style={{display:"flex",gap:12}}>
            {url&&<a href={url} target="_blank" rel="noreferrer" style={{flex:1,padding:"12px 20px",background:result.platform==="google"?"linear-gradient(135deg,#4285F4,#34A853)":"linear-gradient(135deg,#0ea5e9,#0891b2)",color:"#fff",borderRadius:10,fontWeight:700,fontSize:14,textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><ExternalLink size={15}/>{result.platform==="google"?"Abrir no Google Ads":"Abrir no Meta Ads"}</a>}
            <button onClick={()=>{setResult(null);setStep(0);setPlatform(null);setAiMsgs([]);setForm({name:"",objective:"",optimization_goal:"",cbo:false,channel_type:"SEARCH",cpc_bid:"1.50",daily_budget:"50",country:"BR",age_min:18,age_max:55,adset_name:"",destination_url:"",primary_text:"",headline:""});}} style={{flex:1,padding:"12px 20px",background:S2,color:TX,borderRadius:10,fontWeight:600,fontSize:14,border:`1px solid ${BD}`,cursor:"pointer"}}>Nova campanha</button>
          </div>
        </div>
      </div>
    );
  }

  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:F,display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes slideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .cbi{background:${S2};border:1px solid ${BD};border-radius:10px;color:${TX};font-family:${F};font-size:14px;padding:11px 14px;width:100%;box-sizing:border-box;outline:none;transition:border-color 0.2s;}
        .cbi:focus{border-color:${PRIMARY};}
        .cbi::placeholder{color:${MT};}
        .cbc{background:${S1};border:1.5px solid ${BD};border-radius:12px;padding:16px;cursor:pointer;transition:all 0.15s;}
        .cbc:hover{border-color:rgba(14,165,233,0.4);background:rgba(14,165,233,0.05);}
        .cbc.ms{border-color:${PRIMARY};background:rgba(14,165,233,0.08);}
        .cbc.gs{border-color:${GBLUE};background:rgba(66,133,244,0.08);}
        .cbt{padding:8px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s;border:1.5px solid ${BD};background:${S2};color:${TX};font-family:${F};}
        .cbt.ma{border-color:${PRIMARY};background:rgba(14,165,233,0.1);color:${PRIMARY};}
        .cbt.ga{border-color:${GBLUE};background:rgba(66,133,244,0.1);color:${GBLUE};}
      `}</style>

      {/* Header */}
      <div style={{borderBottom:`1px solid ${BD}`,padding:"16px 24px",display:"flex",alignItems:"center",gap:16}}>
        <button onClick={()=>navigate("/dashboard/performance")} style={{background:"none",border:"none",color:MT,cursor:"pointer",padding:4,display:"flex"}}><ChevronLeft size={20}/></button>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
          <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${platform==="google"?"#4285F4,#34A853":"#0ea5e9,#06b6d4"})`,display:"flex",alignItems:"center",justifyContent:"center"}}><Rocket size={16} color="#fff"/></div>
          <div>
            <p style={{margin:0,fontSize:15,fontWeight:700,color:TX}}>Criar campanha</p>
            <p style={{margin:0,fontSize:12,color:MT}}>Co-piloto AI ativo — {platform?`${platform==="meta"?"Meta Ads":"Google Ads"}`:"escolha a plataforma"}</p>
          </div>
        </div>
        {personas.length>1&&<select value={persona?.id||""} onChange={e=>setPersona(personas.find(p=>p.id===e.target.value)||null)} className="cbi" style={{width:"auto",fontSize:13,padding:"8px 12px"}}>{personas.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      </div>

      {/* Steps */}
      <div style={{padding:"14px 24px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"center",overflowX:"auto",gap:0}}>
        {STEP_LABELS.map((s,i)=>{
          const Icon=STEP_ICONS[i],active=i===step,done=i<step;
          return(
            <React.Fragment key={s}>
              <div onClick={()=>done&&setStep(i)} style={{display:"flex",alignItems:"center",gap:7,cursor:done?"pointer":"default",opacity:active||done?1:0.35,flexShrink:0}}>
                <div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:done?"rgba(34,197,94,0.18)":active?`${pColor}20`:S2,border:`1.5px solid ${done?"rgba(34,197,94,0.45)":active?pColor:BD}`,transition:"all 0.2s"}}>
                  {done?<Check size={12} color="#86efac"/>:<Icon size={12} color={active?pColor:MT}/>}
                </div>
                <span style={{fontSize:12,fontWeight:active?600:400,color:active?TX:MT,whiteSpace:"nowrap"}}>{s}</span>
              </div>
              {i<STEP_LABELS.length-1&&<div style={{flex:1,height:1,background:i<step?"rgba(34,197,94,0.25)":BD,margin:"0 10px",minWidth:16}}/>}
            </React.Fragment>
          );
        })}
      </div>

      {/* Body */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        <div style={{flex:1,padding:"28px 32px",overflowY:"auto"}}>

          {/* STEP 0: Platform */}
          {step===0&&(
            <div>
              <h2 style={{fontSize:22,fontWeight:800,color:TX,margin:"0 0 6px"}}>Onde você quer anunciar?</h2>
              <p style={{color:MT,fontSize:14,margin:"0 0 28px"}}>A conta precisa estar conectada em <strong style={{color:TX}}>Accounts</strong> para criar campanhas.</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
                {[
                  {id:"meta" as Platform,label:"Meta Ads",desc:"Facebook e Instagram",gradient:"linear-gradient(135deg,#0ea5e9,#06b6d4)",glyph:"f",color:PRIMARY},
                  {id:"google" as Platform,label:"Google Ads",desc:"Search, Display e YouTube",gradient:"linear-gradient(135deg,#4285F4,#34A853)",glyph:"G",color:GBLUE},
                ].map(plt=>{
                  const connected=isConnected(plt.id),selected=platform===plt.id;
                  return(
                    <div key={plt.id} onClick={()=>{if(!connected)return;setPlatform(plt.id);triggerAI("plataforma",{platform:plt.id});}}
                      style={{background:selected?`${plt.color}12`:S1,border:`1.5px solid ${selected?plt.color:connected?BD:"rgba(255,255,255,0.04)"}`,borderRadius:16,padding:24,cursor:connected?"pointer":"not-allowed",transition:"all 0.15s",opacity:connected?1:0.45,position:"relative"}}>
                      <div style={{width:48,height:48,borderRadius:12,background:plt.gradient,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14,fontSize:22,fontWeight:800,color:"#fff",fontFamily:"serif"}}>{plt.glyph}</div>
                      <p style={{margin:"0 0 4px",fontSize:18,fontWeight:800,color:TX}}>{plt.label}</p>
                      <p style={{margin:"0 0 16px",fontSize:13,color:MT}}>{plt.desc}</p>
                      {connsLoading?(
                        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:MT}}><Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>Verificando...</div>
                      ):connected?(
                        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:GREEN}}><CheckCircle2 size={13}/>Conta conectada</div>
                      ):(
                        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:AMBER}}><AlertTriangle size={13}/>Não conectado —{" "}
                          <button onClick={e=>{e.stopPropagation();navigate("/dashboard/accounts");}} style={{background:"none",border:"none",color:AMBER,cursor:"pointer",fontWeight:700,fontSize:12,padding:0,fontFamily:F,textDecoration:"underline"}}>conectar</button>
                        </div>
                      )}
                      {selected&&<div style={{position:"absolute",top:16,right:16,width:20,height:20,borderRadius:"50%",background:plt.color,display:"flex",alignItems:"center",justifyContent:"center"}}><Check size={12} color="#fff"/></div>}
                    </div>
                  );
                })}
              </div>
              {platform&&!isConnected(platform)&&(
                <div style={{display:"flex",gap:10,padding:"12px 16px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10}}>
                  <AlertCircle size={16} color={AMBER} style={{flexShrink:0,marginTop:1}}/>
                  <p style={{margin:0,fontSize:13,color:AMBER}}>Conecte sua conta {platform==="meta"?"Meta Ads":"Google Ads"} em <strong>Accounts</strong> antes de criar uma campanha.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 1: Objective */}
          {step===1&&(
            <div>
              <h2 style={{fontSize:22,fontWeight:800,color:TX,margin:"0 0 6px"}}>Qual o objetivo?</h2>
              <p style={{color:MT,fontSize:14,margin:"0 0 28px"}}>{platform==="meta"?"Escolha o objetivo da campanha.":"Escolha o tipo de campanha."}</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(165px,1fr))",gap:12,marginBottom:28}}>
                {(platform==="meta"?META_OBJECTIVES:GOOGLE_CHANNELS).map(obj=>{
                  const sel=platform==="meta"?form.objective===obj.id:form.channel_type===obj.id;
                  return(
                    <div key={obj.id} className={`cbc${sel?(platform==="google"?" gs":" ms"):""}`}
                      onClick={()=>{
                        if(platform==="meta"){set("objective",obj.id);set("optimization_goal",META_OPT[obj.id]?.[0]?.id||"");}
                        else set("channel_type",obj.id);
                        triggerAI("objetivo",{objective:obj.id,channel_type:obj.id,platform});
                      }}>
                      <div style={{fontSize:28,marginBottom:8}}>{(obj as any).icon}</div>
                      <p style={{margin:"0 0 4px",fontSize:14,fontWeight:700,color:TX}}>{obj.label}</p>
                      <p style={{margin:0,fontSize:12,color:MT}}>{obj.desc}</p>
                    </div>
                  );
                })}
              </div>
              <div style={{marginBottom:20}}>
                <label style={{fontSize:12,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>Nome da campanha *</label>
                <input className="cbi" placeholder="ex: Leads Q2 — Público Frio" value={form.name} onChange={e=>{set("name",e.target.value);triggerAI("nome",{name:e.target.value,platform});}}/>
              </div>
              {platform==="meta"&&META_OPT[form.objective]&&(
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:8}}>Meta de otimização</label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {META_OPT[form.objective].map(g=><button key={g.id} className={`cbt${form.optimization_goal===g.id?" ma":""}`} onClick={()=>set("optimization_goal",g.id)}>{g.label}</button>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Budget */}
          {step===2&&(
            <div>
              <h2 style={{fontSize:22,fontWeight:800,color:TX,margin:"0 0 6px"}}>Orçamento</h2>
              <p style={{color:MT,fontSize:14,margin:"0 0 28px"}}>Defina quanto gastar por dia.</p>
              <div style={{marginBottom:24}}>
                <label style={{fontSize:12,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>Orçamento diário (R$) *</label>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:MT,fontSize:14}}>R$</span>
                  <input className="cbi" style={{paddingLeft:36}} type="number" min="5" step="5" value={form.daily_budget} onChange={e=>{set("daily_budget",e.target.value);triggerAI("orcamento",{daily_budget:e.target.value,platform});}}/>
                </div>
                <p style={{fontSize:12,color:MT,margin:"6px 0 0"}}>{platform==="meta"?"Mín. R$50/dia para sair da fase de aprendizado em ~7 dias.":"Recomendado: 10× o CPC médio esperado por dia."}</p>
              </div>
              {platform==="meta"&&(
                <div style={{background:S1,border:`1px solid ${BD}`,borderRadius:12,padding:16,marginBottom:20}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <p style={{margin:"0 0 4px",fontSize:14,fontWeight:600,color:TX}}>CBO — Otimização de orçamento</p>
                      <p style={{margin:0,fontSize:12,color:MT}}>Meta distribui automaticamente entre os conjuntos.</p>
                    </div>
                    <button onClick={()=>{const n=!form.cbo;set("cbo",n);triggerAI("cbo",{cbo:n,platform:"meta"});}} style={{width:44,height:24,borderRadius:12,background:form.cbo?PRIMARY:BD,border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                      <div style={{position:"absolute",top:3,left:form.cbo?23:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                    </button>
                  </div>
                </div>
              )}
              {platform==="google"&&(
                <div style={{marginBottom:20}}>
                  <label style={{fontSize:12,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>CPC máximo (R$)</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:MT,fontSize:14}}>R$</span>
                    <input className="cbi" style={{paddingLeft:36}} type="number" min="0.10" step="0.10" value={form.cpc_bid} onChange={e=>{set("cpc_bid",e.target.value);triggerAI("cpc",{cpc_bid:e.target.value,platform:"google"});}}/>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Audience */}
          {step===3&&(
            <div>
              <h2 style={{fontSize:22,fontWeight:800,color:TX,margin:"0 0 6px"}}>{platform==="meta"?"Público":"Segmentação"}</h2>
              <p style={{color:MT,fontSize:14,margin:"0 0 28px"}}>{platform==="meta"?"Defina quem vai ver seus anúncios.":"Configure o alcance geográfico."}</p>
              <div style={{marginBottom:20}}>
                <label style={{fontSize:12,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:8}}>País</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {COUNTRIES.map(c=><button key={c.id} className={`cbt${form.country===c.id?(platform==="google"?" ga":" ma"):""}`} onClick={()=>{set("country",c.id);triggerAI("pais",{country:c.id,platform});}}>{c.label}</button>)}
                </div>
              </div>
              {platform==="meta"&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>Idade mínima</label>
                    <input className="cbi" type="number" min={18} max={65} value={form.age_min} onChange={e=>{set("age_min",parseInt(e.target.value));triggerAI("idade",{age_min:parseInt(e.target.value),age_max:form.age_max,platform:"meta"});}}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>Idade máxima</label>
                    <input className="cbi" type="number" min={18} max={65} value={form.age_max} onChange={e=>{set("age_max",parseInt(e.target.value));triggerAI("idade",{age_min:form.age_min,age_max:parseInt(e.target.value),platform:"meta"});}}/>
                  </div>
                </div>
              )}
              <div>
                <label style={{fontSize:12,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>{platform==="meta"?"Nome do conjunto de anúncios":"Nome do grupo de anúncios"}</label>
                <input className="cbi" placeholder={`${form.name} — ${platform==="meta"?"Público 1":"Grupo 1"}`} value={form.adset_name} onChange={e=>set("adset_name",e.target.value)}/>
              </div>
              {platform==="google"&&(
                <div style={{marginTop:20,display:"flex",gap:10,padding:"12px 16px",background:"rgba(66,133,244,0.08)",border:"1px solid rgba(66,133,244,0.2)",borderRadius:10}}>
                  <Info size={14} color={GBLUE} style={{flexShrink:0,marginTop:1}}/>
                  <p style={{margin:0,fontSize:13,color:"#93c5fd"}}>Palavras-chave e interesses são configurados no Google Ads após a criação.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Creative */}
          {step===4&&(
            <div>
              <h2 style={{fontSize:22,fontWeight:800,color:TX,margin:"0 0 6px"}}>Criativo</h2>
              <div style={{display:"flex",gap:10,padding:"10px 14px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,marginBottom:24}}>
                <Info size={14} color={AMBER} style={{flexShrink:0,marginTop:1}}/>
                <p style={{margin:0,fontSize:13,color:AMBER}}>Campanha criada pausada. Adicione o criativo {platform==="meta"?"no Meta Ads Manager":"no Google Ads"} antes de ativar.</p>
              </div>
              <div style={{marginBottom:20}}>
                <label style={{fontSize:12,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>Texto principal</label>
                <textarea className="cbi" rows={4} style={{resize:"vertical"}} placeholder={platform==="meta"?"Copy do anúncio":"Descrição do anúncio"} value={form.primary_text} onChange={e=>{set("primary_text",e.target.value);if(e.target.value.length>20)triggerAI("copy",{primary_text:e.target.value,platform});}}/>
              </div>
              <div style={{marginBottom:20}}>
                <label style={{fontSize:12,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>Headline</label>
                <input className="cbi" placeholder={`Título (máx ${platform==="meta"?40:30} chars)`} value={form.headline} maxLength={platform==="meta"?40:30} onChange={e=>{set("headline",e.target.value);triggerAI("headline",{headline:e.target.value,platform});}}/>
                <p style={{fontSize:12,color:MT,margin:"4px 0 0",textAlign:"right"}}>{form.headline.length}/{platform==="meta"?40:30}</p>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:MT,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:6}}>URL de destino</label>
                <input className="cbi" placeholder="https://..." value={form.destination_url} onChange={e=>{set("destination_url",e.target.value);if(e.target.value.startsWith("http"))triggerAI("url",{destination_url:e.target.value,platform});}}/>
              </div>
            </div>
          )}

          {/* STEP 5: Review */}
          {step===5&&(
            <div>
              <h2 style={{fontSize:22,fontWeight:800,color:TX,margin:"0 0 6px"}}>Revisar e criar</h2>
              <p style={{color:MT,fontSize:14,margin:"0 0 28px"}}>Campanha criada <strong style={{color:"#fcd34d"}}>pausada</strong>. Ative após revisar.</p>
              {error&&<div style={{display:"flex",gap:10,padding:"12px 16px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,marginBottom:20}}><AlertCircle size={16} color={RED} style={{flexShrink:0,marginTop:1}}/><p style={{margin:0,fontSize:13,color:"#f87171"}}>{error}</p></div>}
              <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 14px",background:platform==="google"?"rgba(66,133,244,0.1)":"rgba(14,165,233,0.1)",border:`1px solid ${platform==="google"?"rgba(66,133,244,0.3)":"rgba(14,165,233,0.3)"}`,borderRadius:20,marginBottom:20}}>
                <span style={{fontSize:13,fontWeight:600,color:pColor}}>{platform==="google"?"Google Ads":"Meta Ads"}</span>
              </div>
              {[
                {label:"Nome",value:form.name,icon:"📝"},
                {label:"Objetivo",value:platform==="meta"?META_OBJECTIVES.find(o=>o.id===form.objective)?.label:GOOGLE_CHANNELS.find(c=>c.id===form.channel_type)?.label,icon:"🎯"},
                {label:"Orçamento diário",value:`R$ ${form.daily_budget}${platform==="meta"&&form.cbo?" (CBO)":""}`,icon:"💰"},
                {label:"País",value:COUNTRIES.find(c=>c.id===form.country)?.label,icon:"🌍"},
                ...(platform==="meta"?[{label:"Faixa etária",value:`${form.age_min}–${form.age_max} anos`,icon:"👥"}]:[]),
                ...(platform==="google"?[{label:"CPC máximo",value:`R$ ${form.cpc_bid}`,icon:"💲"}]:[]),
              ].map(item=>(
                <div key={item.label} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",background:S1,borderRadius:10,marginBottom:8,border:`1px solid ${BD}`}}>
                  <span style={{fontSize:18}}>{item.icon}</span>
                  <div>
                    <p style={{margin:0,fontSize:11,color:MT,textTransform:"uppercase",letterSpacing:"0.06em"}}>{item.label}</p>
                    <p style={{margin:0,fontSize:14,fontWeight:600,color:TX}}>{item.value||"—"}</p>
                  </div>
                </div>
              ))}
              <button onClick={launch} disabled={launching} style={{width:"100%",marginTop:24,padding:"14px 20px",background:launching?S2:platform==="google"?"linear-gradient(135deg,#4285F4,#34A853)":"linear-gradient(135deg,#0ea5e9,#0891b2)",color:"#fff",borderRadius:12,fontWeight:700,fontSize:16,border:"none",cursor:launching?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                {launching?<><Loader2 size={18} style={{animation:"spin 1s linear infinite"}}/>Criando...</>:<><Rocket size={18}/>Criar campanha pausada</>}
              </button>
            </div>
          )}

          {step<5&&(
            <div style={{display:"flex",gap:12,marginTop:32}}>
              {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{padding:"11px 20px",background:S2,color:TX,borderRadius:10,fontWeight:600,fontSize:14,border:`1px solid ${BD}`,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><ChevronLeft size={16}/>Voltar</button>}
              <button onClick={()=>setStep(s=>s+1)} disabled={!canNext()} style={{flex:1,padding:"11px 20px",background:canNext()?pColor:S2,color:canNext()?"#fff":MT,borderRadius:10,fontWeight:700,fontSize:14,border:"none",cursor:canNext()?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.15s"}}>Continuar <ChevronRight size={16}/></button>
            </div>
          )}
        </div>

        {/* AI Panel */}
        <div style={{width:300,borderLeft:`1px solid ${BD}`,background:S1,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${BD}`,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:aiLoading?PRIMARY:GREEN,animation:aiLoading?"pulse 1s infinite":"none"}}/>
            <p style={{margin:0,fontSize:13,fontWeight:600,color:TX}}>Co-piloto IA</p>
            <span style={{marginLeft:"auto",fontSize:11,color:MT}}>Dados reais</span>
          </div>
          <div ref={aiRef} style={{flex:1,overflowY:"auto",padding:14}}>
            {aiMsgs.length===0&&!aiLoading&&(
              <div style={{textAlign:"center",padding:"28px 12px"}}>
                <div style={{fontSize:28,marginBottom:10}}>🧠</div>
                <p style={{color:MT,fontSize:13,margin:0,lineHeight:1.6}}>Preencha os campos e o co-piloto vai comentar com base nos dados da sua conta.</p>
              </div>
            )}
            {aiMsgs.map(msg=>(
              <div key={msg.id} style={{...msgSt(msg.type),animation:"slideIn 0.3s ease"}}>
                <span style={{fontSize:13,flexShrink:0}}>{msgIc(msg.type)}</span>
                <span style={{fontSize:13,lineHeight:1.5}}>{msg.text}</span>
              </div>
            ))}
            {aiLoading&&(
              <div style={{display:"flex",gap:6,padding:"10px 14px",background:"rgba(14,165,233,0.06)",borderRadius:10,border:"1px solid rgba(14,165,233,0.12)",alignItems:"center"}}>
                {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:PRIMARY,animation:`pulse 1.2s ${i*0.2}s infinite`}}/>)}
                <span style={{fontSize:12,color:MT,marginLeft:4}}>Analisando...</span>
              </div>
            )}
          </div>
          <div style={{padding:"10px 14px",borderTop:`1px solid ${BD}`}}>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <TrendingUp size={11} color={MT}/>
              <p style={{margin:0,fontSize:11,color:MT}}>{persona?`Conta: ${persona.name}`:"Selecione uma conta"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
