// CampaignBuilder v4 — single column flow, live preview, minimal
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Loader2, Rocket, Check, AlertCircle, Send, Zap, Users, ShoppingCart, Heart, Eye, Search, Monitor, Play, Globe } from "lucide-react";

type Platform = "meta" | "google";
interface Persona { id: string; name: string; result?: any; }
interface AiMsg  { id: string; text: string; type: "tip"|"warn"|"insight"|"ok"; fromUser?: boolean; }
interface Form {
  name: string; objective: string; optimization_goal: string; cbo: boolean;
  channel_type: string; cpc_bid: string; daily_budget: string; country: string;
  age_min: number; age_max: number; destination_url: string; primary_text: string; headline: string;
}

const META_OBJ = [
  { id:"OUTCOME_TRAFFIC",    label:"Tráfego",       desc:"Cliques no link",        Icon: Zap },
  { id:"OUTCOME_LEADS",      label:"Leads",          desc:"Formulário / mensagem",  Icon: Users },
  { id:"OUTCOME_SALES",      label:"Vendas",         desc:"Compras e conversões",   Icon: ShoppingCart },
  { id:"OUTCOME_ENGAGEMENT", label:"Engajamento",    desc:"Curtidas e comentários", Icon: Heart },
  { id:"OUTCOME_AWARENESS",  label:"Reconhecimento", desc:"Alcance e memória",      Icon: Eye },
];
const GOOGLE_CH = [
  { id:"SEARCH",          label:"Search",    desc:"Resultados de busca",         Icon: Search },
  { id:"DISPLAY",         label:"Display",   desc:"Banners em sites parceiros",  Icon: Monitor },
  { id:"VIDEO",           label:"YouTube",   desc:"Anúncios em vídeos",          Icon: Play },
  { id:"PERFORMANCE_MAX", label:"Perf. Max", desc:"Todas as redes automático",   Icon: Globe },
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
const DFLT: Form = {
  name:"", objective:"", optimization_goal:"", cbo:false,
  channel_type:"", cpc_bid:"1.50", daily_budget:"", country:"BR",
  age_min:18, age_max:65, destination_url:"", primary_text:"", headline:"",
};
const accent = "#0ea5e9";
const F = "'Plus Jakarta Sans', system-ui, sans-serif";
const MONO = "'DM Mono', monospace";
const inputStyle: React.CSSProperties = {
  width:"100%", padding:"11px 14px", background:"var(--bg-surface)",
  border:"1px solid var(--border-subtle)", borderRadius:10,
  color:"var(--text-primary)", fontSize:14, fontFamily:F, outline:"none",
  boxSizing:"border-box", transition:"border-color 0.2s",
};
const labelStyle: React.CSSProperties = {
  display:"block", fontSize:11, fontWeight:700, color:"var(--text-muted)",
  letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8, fontFamily:F,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{marginBottom:20}}><label style={labelStyle}>{label}</label>{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{marginBottom:36}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div style={{height:1,flex:1,background:"var(--border-subtle)"}}/>
        <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.18)",letterSpacing:"0.14em",textTransform:"uppercase",fontFamily:F,flexShrink:0}}>{title}</span>
        <div style={{height:1,flex:1,background:"var(--border-subtle)"}}/>
      </div>
      {children}
    </div>
  );
}

function ObjCard({ obj, selected, onClick }: { obj: typeof META_OBJ[0]; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:12,cursor:"pointer",
      background: selected ? "rgba(14,165,233,0.08)" : "var(--bg-surface)",
      border:`1px solid ${selected ? "rgba(14,165,233,0.35)" : "var(--border-subtle)"}`,
      textAlign:"left",width:"100%",fontFamily:F,transition:"all 0.15s",
      boxShadow: selected ? "0 0 0 1px rgba(14,165,233,0.12), 0 4px 20px rgba(14,165,233,0.1)" : "none",
    }}>
      <div style={{
        width:40,height:40,borderRadius:10,flexShrink:0,
        background: selected ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.04)",
        border:`1px solid ${selected ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.06)"}`,
        display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",
      }}>
        <obj.Icon size={17} color={selected ? accent : "rgba(255,255,255,0.35)"} />
      </div>
      <div style={{flex:1}}>
        <p style={{margin:0,fontSize:14,fontWeight:600,color: selected ? "var(--text-primary)" : "var(--text-secondary)"}}>{obj.label}</p>
        <p style={{margin:"2px 0 0",fontSize:12,color:"var(--text-muted)"}}>{obj.desc}</p>
      </div>
      {selected && <div style={{width:20,height:20,borderRadius:"50%",background:"rgba(14,165,233,0.15)",border:"1px solid rgba(14,165,233,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Check size={11} color={accent}/></div>}
    </button>
  );
}

function CopilotPanel({ userId, personaId, personaName, platform, form, askKey }: {
  userId:string;personaId:string;personaName:string;platform:Platform;form:Form;askKey:string;
}) {
  const [msgs, setMsgs] = useState<AiMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastKey = useRef("");

  const ask = useCallback(async (trigger: string, ctx: any) => {
    const key = trigger + JSON.stringify(ctx);
    if (key === lastKey.current) return;
    lastKey.current = key;
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("campaign-copilot", {
        body: { user_id:userId, persona_id:personaId, persona_name:personaName, platform, trigger, form_ctx:ctx },
      });
      const m: AiMsg[] = (res.data?.messages||[]).map((m:any)=>({...m,id:Math.random().toString(36).slice(2)}));
      if (m.length) setMsgs(prev=>[...prev.slice(-8),...m]);
    } catch {}
    setLoading(false);
  }, [userId, personaId, personaName, platform]);

  useEffect(()=>{ if(askKey) ask("form_update",form); },[askKey]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,loading]);

  const send = async () => {
    const q = input.trim(); if(!q) return; setInput("");
    setMsgs(prev=>[...prev,{id:Math.random().toString(36).slice(2),type:"tip",text:q,fromUser:true}]);
    await ask("chat",{...form,user_question:q});
  };

  const tc: Record<string,string> = {tip:"#38bdf8",warn:"#fbbf24",insight:"#a78bfa",ok:"#34d399"};

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"var(--bg-surface)",borderLeft:"1px solid var(--border-subtle)"}}>
      <div style={{padding:"16px 18px",borderBottom:"1px solid var(--border-subtle)",display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:loading?accent:"#34d399",flexShrink:0}}/>
        <p style={{margin:0,fontSize:13,fontWeight:600,color:"var(--text-primary)",fontFamily:F}}>Co-piloto</p>
        <span style={{marginLeft:"auto",fontSize:11,color:"var(--text-muted)",fontFamily:F}}>dados reais</span>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
        {msgs.length===0&&!loading&&(
          <div style={{padding:"32px 8px",textAlign:"center"}}>
            <p style={{margin:0,fontSize:13,color:"var(--text-muted)",lineHeight:1.7,fontFamily:F}}>Preencha os campos e o co-piloto analisa com base nos dados da sua conta.</p>
          </div>
        )}
        {msgs.map(msg=>msg.fromUser
          ? <div key={msg.id} style={{display:"flex",justifyContent:"flex-end"}}><span style={{fontSize:12,padding:"8px 12px",maxWidth:"85%",background:"rgba(14,165,233,0.1)",border:"1px solid rgba(14,165,233,0.2)",borderRadius:"12px 12px 3px 12px",color:"#7dd3fc",fontFamily:F,lineHeight:1.5}}>{msg.text}</span></div>
          : <div key={msg.id} style={{padding:"10px 12px",borderRadius:10,background:"var(--bg-card)",border:`1px solid ${tc[msg.type]||accent}20`,borderLeft:`3px solid ${tc[msg.type]||accent}`,animation:"fadeUp 0.2s ease"}}>
              <span style={{fontSize:12,color:"var(--text-primary)",lineHeight:1.6,fontFamily:F}}>{msg.text}</span>
            </div>
        )}
        {loading&&<div style={{display:"flex",gap:5,padding:"10px 12px",background:"var(--bg-card)",borderRadius:10,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:accent,animation:`pulse 1.2s ${i*0.2}s infinite`}}/>)}</div>}
        <div ref={bottomRef}/>
      </div>
      <div style={{padding:"10px 12px",borderTop:"1px solid var(--border-subtle)",display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Pergunte sobre a campanha..."
          style={{...inputStyle,fontSize:12,padding:"8px 12px",flex:1,borderRadius:8}}/>
        <button onClick={send} style={{width:32,height:32,borderRadius:8,border:"none",flexShrink:0,background:input.trim()?accent:"var(--bg-card)",cursor:input.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.15s"}}>
          <Send size={13} color={input.trim()?"#fff":"rgba(255,255,255,0.2)"}/>
        </button>
      </div>
    </div>
  );
}

export default function CampaignBuilder() {
  const { user, selectedPersona } = useOutletContext<DashboardContext>();
  const userId = user?.id || "";
  const persona = selectedPersona as Persona | null;
  const [platform, setPlatform] = useState<Platform>("meta");
  const [form, setForm] = useState<Form>(DFLT);
  const [conns, setConns] = useState<any[]>([]);
  const [connsReady, setConnsReady] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [askKey, setAskKey] = useState("");
  const debRef = useRef<any>(null);
  const pc = platform === "google" ? "#34A853" : accent;

  const set = (k: keyof Form, v: any) => {
    setForm(f=>({...f,[k]:v}));
    clearTimeout(debRef.current);
    debRef.current = setTimeout(()=>setAskKey(k+Date.now()),1200);
  };

  useEffect(()=>{
    if(!userId||!persona?.id) return;
    supabase.from("platform_connections" as any)
      .select("platform,status,ad_accounts,selected_account_id")
      .eq("user_id",userId).eq("status","active")
      .then(({data})=>{setConns((data||[]) as any[]);setConnsReady(true);});
  },[userId,persona?.id]);

  const isConnected = (p:Platform) => conns.some(c=>c.platform===p&&(c.ad_accounts?.length??0)>0);

  const launch = async () => {
    if(!userId||!persona?.id) return;
    setLaunching(true);setError("");
    try {
      const fn = platform==="meta"?"create-campaign":"create-campaign-google";
      const conn = conns.find(c=>c.platform===platform);
      const acc = conn?.ad_accounts?.find((a:any)=>a.id===conn.selected_account_id)||conn?.ad_accounts?.[0];
      const body = platform==="meta" ? {
        user_id:userId,persona_id:persona.id,account_id:acc?.id,
        name:form.name||"Nova campanha",objective:form.objective,
        optimization_goal:form.optimization_goal||META_OPT[form.objective]?.[0]?.id,
        daily_budget:Math.round(parseFloat(form.daily_budget||"10")*100),
        country:form.country,age_min:form.age_min,age_max:form.age_max,cbo:form.cbo,
        destination_url:form.destination_url||undefined,
        primary_text:form.primary_text||undefined,
        headline:form.headline||undefined,
      } : {
        user_id:userId,persona_id:persona.id,customer_id:acc?.id,
        name:form.name||"Nova campanha",channel_type:form.channel_type,
        daily_budget:Math.round(parseFloat(form.daily_budget||"10")*1_000_000),
        country:form.country,cpc_bid:form.cpc_bid,
      };
      const res = await supabase.functions.invoke(fn,{body});
      if(res.error?.message?.includes("401")||res.data?.error==="unauthorized"){setError("Sessão expirada — recarregue a página.");return;}
      if(res.error||res.data?.error){setError(res.data?.error||res.error?.message||"Erro ao criar campanha");return;}
      setSuccess(true);
    } catch(e){setError(String(e));}
    finally{setLaunching(false);}
  };

  const canLaunch = connsReady&&isConnected(platform)&&form.daily_budget&&parseFloat(form.daily_budget)>0&&
    (platform==="meta"?!!form.objective:!!form.channel_type);

  if(success) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100%",padding:40}}>
      <div style={{textAlign:"center",maxWidth:360}}>
        <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px"}}><Check size={28} color="#34d399"/></div>
        <h2 style={{margin:"0 0 10px",fontSize:22,fontWeight:800,color:"var(--text-primary)",fontFamily:F}}>Campanha criada</h2>
        <p style={{margin:"0 0 28px",color:"var(--text-muted)",fontSize:14,fontFamily:F,lineHeight:1.6}}>Criada no modo <strong style={{color:"#fcd34d"}}>pausada</strong>. Revise na plataforma antes de ativar.</p>
        <button onClick={()=>{setSuccess(false);setForm(DFLT);setError("");}}
          style={{padding:"11px 28px",borderRadius:10,background:accent,color:"#fff",border:"none",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:F}}>Nova campanha</button>
      </div>
    </div>
  );

  return(
    <div style={{display:"flex",height:"100%",overflow:"hidden",fontFamily:F}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        input[type=range]::-webkit-slider-thumb{background:${accent};}
        input[type=range]::-webkit-slider-runnable-track{background:var(--border-default);height:4px;border-radius:2px;}
        .cb-input:focus{border-color:${accent}!important;}
        select{appearance:auto;}
      `}</style>

      {/* Form */}
      <div style={{flex:1,overflowY:"auto",padding:"32px 40px",maxWidth:660}}>
        <div style={{marginBottom:28}}>
          <h1 style={{margin:"0 0 4px",fontSize:20,fontWeight:800,color:"var(--text-primary)",letterSpacing:"-0.03em"}}>Nova campanha</h1>
          <p style={{margin:0,fontSize:13,color:"var(--text-muted)"}}>{persona?.name||"Selecione uma conta"}</p>
        </div>

        {/* Platform */}
        <div style={{display:"flex",gap:4,marginBottom:32,background:"var(--bg-surface)",border:"1px solid var(--border-subtle)",borderRadius:12,padding:4}}>
          {(["meta","google"] as Platform[]).map(p=>{
            const a=platform===p;const c=p==="google"?"#34A853":accent;
            return<button key={p} onClick={()=>{setPlatform(p);setForm(DFLT);setError("");}}
              style={{flex:1,padding:"9px 0",borderRadius:9,border:"none",cursor:"pointer",
                background:a?`${c}12`:"transparent",color:a?"var(--text-primary)":"var(--text-muted)",
                fontSize:13,fontWeight:a?700:400,fontFamily:F,
                boxShadow:a?`inset 0 0 0 1px ${c}30`:"none",transition:"all 0.15s"}}>
              {p==="meta"?"Meta Ads":"Google Ads"}
            </button>;
          })}
        </div>

        {connsReady&&!isConnected(platform)&&(
          <div style={{display:"flex",gap:10,padding:"12px 16px",background:"rgba(251,191,36,0.05)",border:"1px solid rgba(251,191,36,0.18)",borderRadius:10,marginBottom:28}}>
            <AlertCircle size={15} color="#fbbf24" style={{flexShrink:0,marginTop:1}}/>
            <p style={{margin:0,fontSize:13,color:"#fbbf24",fontFamily:F}}>{platform==="meta"?"Meta Ads":"Google Ads"} não conectado — <a href="/dashboard/accounts" style={{color:"#fbbf24",textDecoration:"underline"}}>conectar em Contas</a></p>
          </div>
        )}

        <Section title="Objetivo">
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {(platform==="meta"?META_OBJ:GOOGLE_CH).map(obj=>(
              <ObjCard key={obj.id} obj={obj}
                selected={platform==="meta"?form.objective===obj.id:form.channel_type===obj.id}
                onClick={()=>platform==="meta"?set("objective",obj.id):set("channel_type",obj.id)}/>
            ))}
          </div>
        </Section>

        {platform==="meta"&&form.objective&&META_OPT[form.objective]&&(
          <Section title="Otimização">
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {META_OPT[form.objective].map(opt=>{
                const a=form.optimization_goal===opt.id;
                return<button key={opt.id} onClick={()=>set("optimization_goal",opt.id)}
                  style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${a?`${accent}40`:"var(--border-subtle)"}`,
                    background:a?`${accent}10`:"var(--bg-surface)",color:a?accent:"var(--text-muted)",
                    fontSize:13,fontWeight:a?600:400,cursor:"pointer",fontFamily:F,transition:"all 0.15s"}}>{opt.label}</button>;
              })}
            </div>
          </Section>
        )}

        <Section title="Identificação">
          <Field label="Nome da campanha">
            <input className="cb-input" style={inputStyle} placeholder={`Ex: ${platform==="meta"?"Leads BR — Fev 2026":"Search — Marca BR"}`}
              value={form.name} onChange={e=>set("name",e.target.value)}/>
          </Field>
        </Section>

        <Section title="Orçamento">
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <Field label="Orçamento diário (R$)">
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"var(--text-muted)",fontSize:13,fontFamily:MONO,pointerEvents:"none"}}>R$</span>
                  <input className="cb-input" style={{...inputStyle,paddingLeft:40}} type="number" min="1" placeholder="100"
                    value={form.daily_budget} onChange={e=>set("daily_budget",e.target.value)}/>
                </div>
              </Field>
            </div>
            {platform==="google"&&(
              <div style={{flex:1}}>
                <Field label="CPC máximo (R$)">
                  <input className="cb-input" style={inputStyle} type="number" min="0.01" step="0.10"
                    value={form.cpc_bid} onChange={e=>set("cpc_bid",e.target.value)}/>
                </Field>
              </div>
            )}
          </div>
          {platform==="meta"&&(
            <label style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",userSelect:"none"}}>
              <div onClick={()=>set("cbo",!form.cbo)} style={{width:40,height:22,borderRadius:11,position:"relative",flexShrink:0,
                background:form.cbo?accent:"var(--bg-elevated)",border:`1px solid ${form.cbo?accent:"var(--border-default)"}`,
                transition:"all 0.2s",cursor:"pointer"}}>
                <div style={{position:"absolute",width:16,height:16,borderRadius:"50%",background:"#fff",
                  top:2,left:form.cbo?20:2,transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
              </div>
              <div>
                <span style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)",fontFamily:F}}>CBO</span>
                <span style={{fontSize:12,color:"var(--text-muted)",fontFamily:F,display:"block"}}>Meta distribui o budget automaticamente entre conjuntos</span>
              </div>
            </label>
          )}
        </Section>

        <Section title="Público">
          <Field label="País">
            <select className="cb-input" style={{...inputStyle,cursor:"pointer"}} value={form.country} onChange={e=>set("country",e.target.value)}>
              {COUNTRIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          {platform==="meta"&&(
            <Field label={`Faixa etária — ${form.age_min} a ${form.age_max} anos`}>
              <div style={{display:"flex",gap:20}}>
                <div style={{flex:1}}>
                  <p style={{...labelStyle,marginBottom:6,fontSize:10}}>Mínimo: {form.age_min}</p>
                  <input type="range" min={18} max={64} value={form.age_min}
                    onChange={e=>{const v=parseInt(e.target.value);if(v<form.age_max)set("age_min",v);}}
                    style={{width:"100%",accentColor:accent,height:4}}/>
                </div>
                <div style={{flex:1}}>
                  <p style={{...labelStyle,marginBottom:6,fontSize:10}}>Máximo: {form.age_max}</p>
                  <input type="range" min={19} max={65} value={form.age_max}
                    onChange={e=>{const v=parseInt(e.target.value);if(v>form.age_min)set("age_max",v);}}
                    style={{width:"100%",accentColor:accent,height:4}}/>
                </div>
              </div>
            </Field>
          )}
        </Section>

        {platform==="meta"&&(
          <Section title="Criativo (opcional)">
            <Field label="URL de destino">
              <input className="cb-input" style={inputStyle} placeholder="https://..." type="url"
                value={form.destination_url} onChange={e=>set("destination_url",e.target.value)}/>
            </Field>
            <Field label="Texto principal">
              <textarea className="cb-input" style={{...inputStyle,resize:"none",minHeight:80,lineHeight:1.6}}
                placeholder="Texto do anúncio..."
                value={form.primary_text} onChange={e=>set("primary_text",e.target.value)}/>
            </Field>
            <Field label="Headline">
              <input className="cb-input" style={inputStyle} placeholder="Título (máx 40 chars)" maxLength={40}
                value={form.headline} onChange={e=>set("headline",e.target.value)}/>
              {form.headline.length>30&&<p style={{margin:"4px 0 0",fontSize:11,color:form.headline.length>38?"#f87171":"#fbbf24",fontFamily:MONO,textAlign:"right"}}>{form.headline.length}/40</p>}
            </Field>
          </Section>
        )}

        {error&&(
          <div style={{display:"flex",gap:10,padding:"12px 16px",background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.18)",borderRadius:10,marginBottom:16}}>
            <AlertCircle size={15} color="#f87171" style={{flexShrink:0,marginTop:1}}/>
            <p style={{margin:0,fontSize:13,color:"#f87171",fontFamily:F}}>{error}</p>
          </div>
        )}

        <button onClick={launch} disabled={!canLaunch||launching} style={{
          width:"100%",padding:"14px 0",borderRadius:12,border:"none",
          background:canLaunch&&!launching?`linear-gradient(135deg,${pc},${platform==="google"?"#1a8f3c":"#0891b2"})`:"var(--bg-elevated)",
          color:canLaunch?"#fff":"var(--text-muted)",fontSize:15,fontWeight:700,fontFamily:F,
          cursor:canLaunch?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          transition:"all 0.15s",boxShadow:canLaunch?`0 4px 20px ${pc}25`:"none",
        }}>
          {launching?<><Loader2 size={17} style={{animation:"spin 1s linear infinite"}}/>Criando...</>
          :!connsReady?<><Loader2 size={17} style={{animation:"spin 1s linear infinite"}}/>Verificando...</>
          :!isConnected(platform)?"Conecte sua conta para continuar"
          :<><Rocket size={17}/>Criar campanha pausada</>}
        </button>
        <p style={{textAlign:"center",fontSize:12,color:"var(--text-muted)",margin:"10px 0 40px",fontFamily:F}}>Criada pausada — você ativa quando quiser na plataforma</p>
      </div>

      {/* Copilot */}
      {persona?.id&&(
        <div style={{width:290,flexShrink:0}}>
          <CopilotPanel userId={userId} personaId={persona.id} personaName={persona.name||""}
            platform={platform} form={form} askKey={askKey}/>
        </div>
      )}
    </div>
  );
}
