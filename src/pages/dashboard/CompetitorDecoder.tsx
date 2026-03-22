import { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, TrendingUp, Shield, Copy, Check, Zap, AlertCircle, Target, Crosshair } from "lucide-react";
import { toast } from "sonner";

interface ReadyHook { hook: string; type: string; angle: string; }
interface DecodeResult {
  mismatch_detected?: boolean; mismatch_reason?: string;
  framework: string; hook_type: string; hook_formula?: string;
  hook_score: number; hook_strength: string; hook_dissection?: string; pacing?: string;
  emotional_triggers: string[]; persuasion_tactics: string[];
  target_audience: string; creative_model: string;
  strengths: string[]; weaknesses: string[];
  threat_level: string; threat_reason?: string;
  counter_strategy: string; steal_worthy: string[];
  ready_hooks?: (ReadyHook | string)[];
  immediate_action?: string;
}

const THREAT: Record<string,{pt:string;es:string;en:string;color:string;bg:string;border:string}> = {
  critical:{pt:"Ameaça crítica",es:"Amenaza crítica",en:"Critical threat",color:"#f87171",bg:"rgba(248,113,113,0.08)",border:"rgba(248,113,113,0.25)"},
  high:{pt:"Ameaça alta",es:"Amenaza alta",en:"High threat",color:"#fb923c",bg:"rgba(251,146,60,0.08)",border:"rgba(251,146,60,0.25)"},
  medium:{pt:"Ameaça média",es:"Amenaza media",en:"Medium threat",color:"#fbbf24",bg:"rgba(251,191,36,0.08)",border:"rgba(251,191,36,0.25)"},
  low:{pt:"Ameaça baixa",es:"Amenaza baja",en:"Low threat",color:"#34d399",bg:"rgba(52,211,153,0.08)",border:"rgba(52,211,153,0.25)"},
};
const HC: Record<string,{color:string;bg:string;border:string}> = {
  curiosity:{color:"#38bdf8",bg:"rgba(56,189,248,0.10)",border:"rgba(56,189,248,0.20)"},
  pain_point:{color:"#f87171",bg:"rgba(248,113,113,0.10)",border:"rgba(248,113,113,0.20)"},
  social_proof:{color:"#4ade80",bg:"rgba(74,222,128,0.10)",border:"rgba(74,222,128,0.20)"},
  pattern_interrupt:{color:"#fb923c",bg:"rgba(251,146,60,0.10)",border:"rgba(251,146,60,0.20)"},
  direct_offer:{color:"#60a5fa",bg:"rgba(96,165,250,0.10)",border:"rgba(96,165,250,0.20)"},
  emotional:{color:"#f472b6",bg:"rgba(244,114,182,0.10)",border:"rgba(244,114,182,0.20)"},
  question:{color:"#34d399",bg:"rgba(52,211,153,0.10)",border:"rgba(52,211,153,0.20)"},
};
const F = {fontFamily:"'Plus Jakarta Sans', sans-serif"} as const;
const M = {fontFamily:"'Inter', sans-serif"} as const;

const T: Record<string,Record<string,string>> = {
  pt:{
    title:"Decodificador de Concorrente",sub:"Cole qualquer anúncio — a IA decodifica o framework, gatilhos e como superar",
    script_label:"Roteiro / Transcrição / Copy do anúncio",
    script_placeholder:"Cole o roteiro completo, legenda, copy ou VO aqui...\n\nDica: use Traduzir → Vídeo → Transcrição para extrair qualquer vídeo.",
    industry_label:"Setor / Nicho",market_label:"Mercado",
    context_label:"Contexto do seu produto (recomendado)",
    context_placeholder:'Ex: "App de apostas para público BR 25-35, foco em futebol"',
    decode_btn:"Decodificar anúncio",decoding:"Decodificando...",need_more:"Cole pelo menos 20 caracteres",
    mismatch_title:"⚠️ Contexto incompatível",hook_formula:"Fórmula do hook",hook_dissection:"Análise do hook",
    framework:"Framework",hook_score:"Score do Hook",threat_level:"Ameaça",
    target:"Público-alvo",emotional:"Gatilhos",persuasion:"Táticas",
    strengths:"O que funciona",weaknesses:"O que é fraco",
    counter:"Estratégia de contra-ataque",steal:"Elementos para adaptar",
    ready_hooks:"Hooks prontos para usar",copy_hook:"Copiar",copy_strategy:"Copiar estratégia",copied:"Copiado!",
    go_script:"→ Roteiro",immediate:"Ação imediata",
    empty_title:"Cole qualquer anúncio e decodifique o playbook do concorrente",
    empty_sub:"Funciona com legendas do TikTok, copy de Meta Ads, roteiros do YouTube ou qualquer transcrição",
    tip:"Não tem a transcrição? Use",tip_link:"Traduzir → Vídeo → Transcrição",tip_end:"para extrair de qualquer vídeo.",
  },
  es:{
    title:"Decodificador de Competidor",sub:"Pega cualquier anuncio — la IA decodifica el framework, disparadores y cómo superarlo",
    script_label:"Guión / Transcripción / Copy",script_placeholder:"Pega el guión completo, descripción o VO aquí...",
    industry_label:"Sector / Nicho",market_label:"Mercado",context_label:"Contexto de tu producto (recomendado)",
    context_placeholder:'Ej: "App de apuestas para público MX 25-35"',
    decode_btn:"Decodificar anuncio",decoding:"Decodificando...",need_more:"Pega al menos 20 caracteres",
    mismatch_title:"⚠️ Contexto incompatible",hook_formula:"Fórmula del hook",hook_dissection:"Análisis del hook",
    framework:"Framework",hook_score:"Score del Hook",threat_level:"Amenaza",
    target:"Audiencia",emotional:"Disparadores",persuasion:"Tácticas",
    strengths:"Lo que funciona",weaknesses:"Lo que es débil",
    counter:"Estrategia de contraataque",steal:"Elementos para adaptar",
    ready_hooks:"Hooks listos para usar",copy_hook:"Copiar",copy_strategy:"Copiar estrategia",copied:"¡Copiado!",
    go_script:"→ Guión",immediate:"Acción inmediata",
    empty_title:"Pega cualquier anuncio y decodifica el playbook del competidor",
    empty_sub:"Funciona con TikTok, Meta Ads, YouTube o cualquier transcripción",
    tip:"¿Sin transcripción? Usa",tip_link:"Traducir → Video → Transcripción",tip_end:"para extraer de cualquier video.",
  },
  en:{
    title:"Competitor Pattern Decoder",sub:"Paste any ad — AI decodes the framework, tactics, and exactly how to beat it",
    script_label:"Ad script / transcript / copy",
    script_placeholder:"Paste the full transcript, caption, VO script, or ad copy here...\n\nTip: use Translate → Video → Transcript to extract any video.",
    industry_label:"Industry / Niche",market_label:"Market",context_label:"Your product context (recommended)",
    context_placeholder:'e.g. "Betting app for BR audience 25-35, football focus"',
    decode_btn:"Decode ad",decoding:"Decoding...",need_more:"Paste at least 20 characters",
    mismatch_title:"⚠️ Context mismatch",hook_formula:"Hook formula",hook_dissection:"Hook breakdown",
    framework:"Framework",hook_score:"Hook score",threat_level:"Threat",
    target:"Target audience",emotional:"Triggers",persuasion:"Tactics",
    strengths:"What's working",weaknesses:"What's weak",
    counter:"Counter strategy",steal:"Elements to adapt",
    ready_hooks:"Ready-to-use hooks",copy_hook:"Copy",copy_strategy:"Copy strategy",copied:"Copied!",
    go_script:"→ Script",immediate:"Immediate action",
    empty_title:"Paste any competitor ad and decode their playbook",
    empty_sub:"Works with TikTok captions, Meta ad copy, YouTube scripts, or any transcript",
    tip:"No transcript yet? Use",tip_link:"Translate → Video → Transcript",tip_end:"to extract from any video.",
  },
};

function Tag({label,color,bg,border}:{label:string;color:string;bg:string;border:string}){
  return <span style={{...M,fontSize:11,fontWeight:600,color,background:bg,border:`1px solid ${border}`,padding:"3px 10px",borderRadius:20,whiteSpace:"nowrap"as const}}>{label}</span>;
}

function ScoreBar({score}:{score:number}){
  const pct=Math.min(100,Math.max(0,(score/10)*100));
  const c=score>=8?"#34d399":score>=6?"#fbbf24":"#f87171";
  return(
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <span style={{...F,fontSize:26,fontWeight:900,color:c,lineHeight:1}}>
        {score?.toFixed(1)}<span style={{fontSize:13,color:"rgba(238,240,246,0.25)"}}>/10</span>
      </span>
      <div style={{flex:1,height:4,borderRadius:99,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:99,background:`linear-gradient(90deg,#a78bfa,${c})`,width:`${pct}%`,transition:"width 0.6s ease"}}/>
      </div>
    </div>
  );
}

export default function CompetitorDecoder(){
  const {selectedPersona}=useOutletContext<DashboardContext>();
  const {language}=useLanguage();
  const navigate=useNavigate();
  const t=T[language]||T.en;
  const lang=language as"pt"|"es"|"en";
  const [adText,setAdText]=useState("");
  const [observation,setObservation]=useState("");
  const [isDragging,setIsDragging]=useState(false);
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState<DecodeResult|null>(null);
  const [copiedIdx,setCopiedIdx]=useState<number|null>(null);
  const [copiedCounter,setCopiedCounter]=useState(false);
  const [copiedAction,setCopiedAction]=useState(false);

  const decode=async(inputText?:string)=>{
    const txt=(inputText||adText).trim();
    if(txt.length<10){toast.error(t.need_more);return;}
    setLoading(true);setResult(null);
    try{
      const personaCtx=selectedPersona?`Account: ${selectedPersona.name}. Platforms: ${(selectedPersona as any).best_platforms?.join(", ")}.`:undefined;
      const{data,error}=await supabase.functions.invoke("decode-competitor",{
        body:{ad_text:txt,observation:observation.trim()||undefined,auto_detect_industry:true,persona_context:personaCtx},
      });
      if(error)throw error;
      setResult(data);
      if(data?.mismatch_detected)toast.warning(lang==="pt"?"Setor/nicho detectado automaticamente — confira se está correto":lang==="es"?"Sector/nicho detectado automáticamente":"Industry auto-detected — verify if correct");
    }catch{toast.error(lang==="pt"?"Decodificação falhou":lang==="es"?"Decodificación fallida":"Decoding failed");}
    finally{setLoading(false);}
  };

  const copyHook=async(hook:string,idx:number)=>{await navigator.clipboard.writeText(hook);setCopiedIdx(idx);toast.success(t.copied);setTimeout(()=>setCopiedIdx(null),2000);};
  const threat=result?(THREAT[result.threat_level]||THREAT.medium):null;
  const hookColor=result?(HC[result.hook_type]||HC.curiosity):null;
  const threatLabel=threat?(lang==="pt"?threat.pt:lang==="es"?threat.es:threat.en):"";
  const getHookText=(h:ReadyHook|string)=>typeof h==="string"?h:h.hook;
  const getHookAngle=(h:ReadyHook|string)=>typeof h==="string"?"":h.angle;
  const getHookType=(h:ReadyHook|string)=>typeof h==="string"?"":h.type;

  return(
    <div style={{padding:"20px 20px 60px",maxWidth:800,margin:"0 auto"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <div style={{width:38,height:38,borderRadius:12,background:"rgba(34,211,238,0.10)",border:"1px solid rgba(34,211,238,0.20)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Crosshair size={18} color="#22d3ee"/>
        </div>
        <div>
          <h1 style={{...F,fontSize:17,fontWeight:800,color:"#eef0f6",margin:0,letterSpacing:"-0.02em"}}>{t.title}</h1>
          <p style={{...M,fontSize:12,color:"rgba(238,240,246,0.42)",marginTop:2}}>{t.sub}</p>
        </div>
      </div>

      {/* Drop zone + link input */}
      <div
        onDragOver={e=>{e.preventDefault();setIsDragging(true);}}
        onDragLeave={()=>setIsDragging(false)}
        onDrop={e=>{
          e.preventDefault();setIsDragging(false);
          const file=e.dataTransfer.files[0];
          if(file&&file.type.startsWith("video/")){
            toast.info(lang==="pt"?"Vídeo recebido — transcrevendo...":lang==="es"?"Video recibido — transcribiendo...":"Video received — transcribing...");
            // TODO: pipe to analyze-video then decode
          }
          const text=e.dataTransfer.getData("text");
          if(text){setAdText(text);decode(text);}
        }}
        style={{borderRadius:16,border:`2px dashed ${isDragging?"rgba(34,211,238,0.55)":"rgba(255,255,255,0.09)"}`,background:isDragging?"rgba(34,211,238,0.04)":"#131720",padding:"28px 20px",marginBottom:12,textAlign:"center"as const,transition:"all 0.15s",cursor:"default"}}>
        <div style={{fontSize:28,marginBottom:8}}>🎯</div>
        <p style={{...F,fontSize:14,fontWeight:700,color:"rgba(238,240,246,0.55)",margin:"0 0 6px"}}>
          {lang==="pt"?"Arraste um vídeo ou cole o link":lang==="es"?"Arrastra un video o pega el enlace":"Drag a video or paste a link"}
        </p>
        <p style={{...M,fontSize:11,color:"rgba(238,240,246,0.25)",margin:"0 0 16px"}}>
          {lang==="pt"?"TikTok, Meta Ads, YouTube, Instagram, qualquer link":lang==="es"?"TikTok, Meta Ads, YouTube, Instagram, cualquier enlace":"TikTok, Meta Ads, YouTube, Instagram, any link"}
        </p>
        <div style={{display:"flex",gap:8,maxWidth:500,margin:"0 auto"}}>
          <input value={adText} onChange={e=>setAdText(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")decode();}}
            placeholder={lang==="pt"?"https://... ou cole o link aqui":lang==="es"?"https://... o pega el enlace aquí":"https://... or paste link here"}
            style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"10px 14px",color:"#eef0f6",...M,fontSize:13,outline:"none",boxSizing:"border-box"as const}}
            onFocus={e=>{e.currentTarget.style.borderColor="rgba(34,211,238,0.40)";}}
            onBlur={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.12)";}}
          />
          <button onClick={()=>decode()} disabled={loading||!adText.trim()}
            style={{padding:"10px 20px",borderRadius:10,background:adText.trim()&&!loading?"#22d3ee":"rgba(34,211,238,0.08)",border:"none",cursor:adText.trim()&&!loading?"pointer":"not-allowed",...F,fontSize:13,fontWeight:800,color:adText.trim()&&!loading?"#000":"rgba(34,211,238,0.30)",whiteSpace:"nowrap"as const,transition:"all 0.15s",flexShrink:0}}>
            {loading?<Loader2 size={14} className="animate-spin"/>:<Zap size={14}/>}
          </button>
        </div>
      </div>

      {/* Observation — optional */}
      <div style={{marginBottom:20}}>
        <label style={{...M,display:"block",fontSize:10,fontWeight:600,color:"rgba(238,240,246,0.28)",letterSpacing:"0.10em",textTransform:"uppercase"as const,marginBottom:6}}>
          {lang==="pt"?"Observação (opcional)":lang==="es"?"Observación (opcional)":"Observation (optional)"}
        </label>
        <textarea value={observation} onChange={e=>setObservation(e.target.value)} rows={2}
          placeholder={lang==="pt"?"O que você quer entender sobre esse anúncio? A IA vai avaliar com isso em mente...":lang==="es"?"¿Qué quieres entender de este anuncio? La IA evaluará con esto en mente...":"What do you want to understand about this ad? The AI will evaluate with this in mind..."}
          style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:10,padding:"10px 14px",color:"#eef0f6",...M,fontSize:13,resize:"none"as const,outline:"none",lineHeight:1.6,boxSizing:"border-box"as const}}
          onFocus={e=>{e.currentTarget.style.borderColor="rgba(34,211,238,0.30)";}}
          onBlur={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.09)";}}
        />
        <p style={{...M,fontSize:10,color:"rgba(238,240,246,0.18)",marginTop:4}}>
          {lang==="pt"?"Setor e nicho são detectados automaticamente pela IA.":lang==="es"?"El sector y nicho son detectados automáticamente por la IA.":"Sector and niche are auto-detected by the AI."}
        </p>
      </div>

      {result&&(
        <div style={{display:"flex",flexDirection:"column"as const,gap:12}}>

          {result.mismatch_detected&&result.mismatch_reason&&(
            <div style={{padding:"16px 18px",borderRadius:14,background:"rgba(251,191,36,0.07)",border:"2px solid rgba(251,191,36,0.28)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <AlertCircle size={16} color="#fbbf24"/>
                <p style={{...F,fontSize:13,fontWeight:800,color:"#fbbf24",margin:0}}>{t.mismatch_title}</p>
              </div>
              <p style={{...M,fontSize:12,color:"rgba(238,240,246,0.62)",lineHeight:1.6,margin:0}}>{result.mismatch_reason}</p>
            </div>
          )}

          {/* Score + Threat + Framework */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <div style={{padding:"16px",borderRadius:14,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)"}}>
              <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(238,240,246,0.28)",letterSpacing:"0.12em",textTransform:"uppercase"as const,marginBottom:10}}>{t.hook_score}</p>
              <ScoreBar score={result.hook_score}/>
              <p style={{...M,fontSize:10,color:"rgba(238,240,246,0.28)",marginTop:6,textTransform:"uppercase"as const,letterSpacing:"0.08em"}}>{result.hook_strength}</p>
            </div>
            {threat&&(
              <div style={{padding:"16px",borderRadius:14,background:threat.bg,border:`1px solid ${threat.border}`}}>
                <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(238,240,246,0.28)",letterSpacing:"0.12em",textTransform:"uppercase"as const,marginBottom:10}}>{t.threat_level}</p>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <AlertTriangle size={15} color={threat.color}/>
                  <p style={{...F,fontSize:14,fontWeight:800,color:threat.color,margin:0}}>{threatLabel}</p>
                </div>
                {result.threat_reason&&<p style={{...M,fontSize:11,color:"rgba(238,240,246,0.38)",lineHeight:1.5,margin:0}}>{result.threat_reason}</p>}
              </div>
            )}
            <div style={{padding:"16px",borderRadius:14,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)"}}>
              <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(238,240,246,0.28)",letterSpacing:"0.12em",textTransform:"uppercase"as const,marginBottom:10}}>{t.framework}</p>
              <p style={{...F,fontSize:14,fontWeight:800,color:"#eef0f6",margin:"0 0 8px"}}>{result.framework}</p>
              <div style={{display:"flex",flexWrap:"wrap"as const,gap:5}}>
                {hookColor&&<Tag label={result.hook_type?.replace(/_/g," ")} color={hookColor.color} bg={hookColor.bg} border={hookColor.border}/>}
                <Tag label={result.creative_model} color="rgba(238,240,246,0.42)" bg="rgba(255,255,255,0.05)" border="rgba(255,255,255,0.10)"/>
              </div>
            </div>
          </div>

          {/* Hook formula + dissection */}
          {(result.hook_formula||result.hook_dissection)&&(
            <div style={{borderRadius:14,background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.18)",overflow:"hidden"}}>
              {result.hook_formula&&(
                <div style={{padding:"14px 18px",borderBottom:result.hook_dissection?"1px solid rgba(167,139,250,0.12)":"none"}}>
                  <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(167,139,250,0.55)",letterSpacing:"0.12em",textTransform:"uppercase"as const,marginBottom:8}}>{t.hook_formula}</p>
                  <p style={{...M,fontSize:13,color:"rgba(238,240,246,0.85)",lineHeight:1.6,margin:0,fontStyle:"italic"as const}}>"{result.hook_formula}"</p>
                </div>
              )}
              {result.hook_dissection&&(
                <div style={{padding:"14px 18px"}}>
                  <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(167,139,250,0.55)",letterSpacing:"0.12em",textTransform:"uppercase"as const,marginBottom:8}}>{t.hook_dissection}</p>
                  <p style={{...M,fontSize:12.5,color:"rgba(238,240,246,0.62)",lineHeight:1.65,margin:0}}>{result.hook_dissection}</p>
                </div>
              )}
            </div>
          )}

          {/* Target + Triggers + Tactics */}
          <div style={{padding:"14px 18px",borderRadius:14,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(238,240,246,0.28)",letterSpacing:"0.12em",textTransform:"uppercase"as const,marginBottom:6}}>{t.target}</p>
            <p style={{...M,fontSize:12.5,color:"rgba(238,240,246,0.68)",margin:"0 0 12px",lineHeight:1.5}}>{result.target_audience}</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(244,114,182,0.50)",letterSpacing:"0.10em",textTransform:"uppercase"as const,marginBottom:7}}>{t.emotional}</p>
                <div style={{display:"flex",flexWrap:"wrap"as const,gap:5}}>
                  {result.emotional_triggers?.map(e2=><Tag key={e2} label={e2} color="#f9a8d4" bg="rgba(244,114,182,0.10)" border="rgba(244,114,182,0.20)"/>)}
                </div>
              </div>
              <div>
                <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(96,165,250,0.50)",letterSpacing:"0.10em",textTransform:"uppercase"as const,marginBottom:7}}>{t.persuasion}</p>
                <div style={{display:"flex",flexWrap:"wrap"as const,gap:5}}>
                  {result.persuasion_tactics?.map(p2=><Tag key={p2} label={p2} color="#93c5fd" bg="rgba(96,165,250,0.10)" border="rgba(96,165,250,0.20)"/>)}
                </div>
              </div>
            </div>
          </div>

          {/* Strengths + Weaknesses */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{padding:"16px 18px",borderRadius:14,background:"rgba(52,211,153,0.05)",border:"1px solid rgba(52,211,153,0.15)"}}>
              <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(52,211,153,0.50)",letterSpacing:"0.12em",textTransform:"uppercase"as const,marginBottom:10}}>{t.strengths}</p>
              <ul style={{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column"as const,gap:8}}>
                {result.strengths?.map((s,i)=>(
                  <li key={i} style={{display:"flex",alignItems:"flex-start",gap:8}}>
                    <span style={{width:16,height:16,borderRadius:"50%",background:"rgba(52,211,153,0.15)",color:"#34d399",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",...M,fontSize:9,fontWeight:700,marginTop:2}}>{i+1}</span>
                    <span style={{...M,fontSize:12,color:"rgba(238,240,246,0.58)",lineHeight:1.5}}>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{padding:"16px 18px",borderRadius:14,background:"rgba(248,113,113,0.05)",border:"1px solid rgba(248,113,113,0.15)"}}>
              <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(248,113,113,0.50)",letterSpacing:"0.12em",textTransform:"uppercase"as const,marginBottom:10}}>{t.weaknesses}</p>
              <ul style={{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column"as const,gap:8}}>
                {result.weaknesses?.map((w,i)=>(
                  <li key={i} style={{display:"flex",alignItems:"flex-start",gap:8}}>
                    <span style={{width:16,height:16,borderRadius:"50%",background:"rgba(248,113,113,0.15)",color:"#f87171",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",...M,fontSize:9,fontWeight:700,marginTop:2}}>{i+1}</span>
                    <span style={{...M,fontSize:12,color:"rgba(238,240,246,0.58)",lineHeight:1.5}}>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Counter strategy */}
          <div style={{padding:"18px",borderRadius:14,background:"rgba(14,165,233,0.06)",border:"1px solid rgba(14,165,233,0.20)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <Shield size={15} color="#0ea5e9"/>
                <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(14,165,233,0.58)",letterSpacing:"0.12em",textTransform:"uppercase"as const,margin:0}}>{t.counter}</p>
              </div>
              <button onClick={async()=>{await navigator.clipboard.writeText(result.counter_strategy);setCopiedCounter(true);toast.success(t.copied);setTimeout(()=>setCopiedCounter(false),2000);}}
                style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:7,background:"rgba(14,165,233,0.10)",border:"1px solid rgba(14,165,233,0.20)",cursor:"pointer",...M,fontSize:11,fontWeight:600,color:"#0ea5e9"}}>
                {copiedCounter?<><Check size={11}/> {t.copied}</>:<><Copy size={11}/> {t.copy_strategy}</>}
              </button>
            </div>
            <p style={{...M,fontSize:13,color:"rgba(238,240,246,0.70)",lineHeight:1.7,margin:0}}>{result.counter_strategy}</p>
          </div>

          {/* Ready hooks — 5 with angle + type badge */}
          {result.ready_hooks&&result.ready_hooks.length>0&&(
            <div style={{borderRadius:14,border:"1px solid rgba(251,191,36,0.20)",overflow:"hidden"}}>
              <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(251,191,36,0.12)",background:"rgba(251,191,36,0.05)",display:"flex",alignItems:"center",gap:8}}>
                <TrendingUp size={15} color="#fbbf24"/>
                <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(251,191,36,0.58)",letterSpacing:"0.12em",textTransform:"uppercase"as const,margin:0}}>{t.ready_hooks}</p>
                <span style={{...M,fontSize:10,color:"rgba(251,191,36,0.35)",marginLeft:"auto"}}>{result.ready_hooks.length} hooks</span>
              </div>
              <div style={{padding:"10px",display:"flex",flexDirection:"column"as const,gap:6}}>
                {result.ready_hooks.map((hookItem,i)=>{
                  const hookText=getHookText(hookItem);
                  const angle=getHookAngle(hookItem);
                  const htype=getHookType(hookItem);
                  const hc=HC[htype]||HC.curiosity;
                  return(
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px",borderRadius:10,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)"}}>
                      <span style={{...M,fontSize:10,fontWeight:800,color:"rgba(251,191,36,0.38)",flexShrink:0,marginTop:3,minWidth:16}}>#{i+1}</span>
                      <div style={{flex:1,minWidth:0}}>
                        {angle&&(
                          <span style={{...M,fontSize:10,fontWeight:700,color:hc.color,background:hc.bg,border:`1px solid ${hc.border}`,padding:"2px 8px",borderRadius:20,display:"inline-block",marginBottom:7}}>
                            {angle}
                          </span>
                        )}
                        <p style={{...M,fontSize:13,color:"rgba(238,240,246,0.82)",lineHeight:1.55,margin:0}}>{hookText}</p>
                      </div>
                      <button onClick={()=>copyHook(hookText,i)}
                        style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:7,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.10)",cursor:"pointer",...M,fontSize:11,color:"rgba(238,240,246,0.50)",whiteSpace:"nowrap"as const,flexShrink:0}}>
                        {copiedIdx===i?<><Check size={11}/> {t.copied}</>:<><Copy size={11}/> {t.copy_hook}</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Steal worthy */}
          {result.steal_worthy?.length>0&&(
            <div style={{padding:"16px 18px",borderRadius:14,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)"}}>
              <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(238,240,246,0.28)",letterSpacing:"0.12em",textTransform:"uppercase"as const,marginBottom:10}}>{t.steal}</p>
              <ul style={{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column"as const,gap:8}}>
                {result.steal_worthy?.map((s,i)=>(
                  <li key={i} style={{display:"flex",alignItems:"flex-start",gap:8}}>
                    <span style={{color:"rgba(251,191,36,0.55)",flexShrink:0,marginTop:2,fontSize:12}}>→</span>
                    <span style={{...M,fontSize:12,color:"rgba(238,240,246,0.58)",lineHeight:1.5}}>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Immediate action */}
          {result.immediate_action&&(
            <div style={{padding:"18px",borderRadius:14,background:"linear-gradient(135deg,rgba(34,211,238,0.08),rgba(14,165,233,0.04))",border:"1px solid rgba(34,211,238,0.25)",position:"relative"as const,overflow:"hidden"}}>
              <div style={{position:"absolute"as const,top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:"radial-gradient(circle,rgba(34,211,238,0.12),transparent 70%)",pointerEvents:"none"}}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <Target size={15} color="#22d3ee"/>
                  <p style={{...M,fontSize:10,fontWeight:700,color:"rgba(34,211,238,0.60)",letterSpacing:"0.12em",textTransform:"uppercase"as const,margin:0}}>{t.immediate}</p>
                </div>
                <button onClick={async()=>{await navigator.clipboard.writeText(result.immediate_action!);setCopiedAction(true);toast.success(t.copied);setTimeout(()=>setCopiedAction(false),2000);}}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:7,background:"rgba(34,211,238,0.10)",border:"1px solid rgba(34,211,238,0.22)",cursor:"pointer",...M,fontSize:11,fontWeight:600,color:"#22d3ee"}}>
                  {copiedAction?<><Check size={11}/> {t.copied}</>:<><Copy size={11}/> {t.copy_hook}</>}
                </button>
              </div>
              <p style={{...F,fontSize:13.5,fontWeight:700,color:"rgba(238,240,246,0.88)",lineHeight:1.6,margin:0}}>{result.immediate_action}</p>
            </div>
          )}

        </div>
      )}

      {!loading&&!result&&(
        <div style={{borderRadius:14,border:"1px dashed rgba(255,255,255,0.09)",padding:"52px 20px",textAlign:"center"as const}}>
          <div style={{fontSize:32,marginBottom:12}}>🎯</div>
          <p style={{...F,fontSize:15,fontWeight:700,color:"rgba(238,240,246,0.42)",margin:"0 0 6px"}}>{t.empty_title}</p>
          <p style={{...M,fontSize:12,color:"rgba(238,240,246,0.20)",margin:0}}>{t.empty_sub}</p>
        </div>
      )}
    </div>
  );
}
