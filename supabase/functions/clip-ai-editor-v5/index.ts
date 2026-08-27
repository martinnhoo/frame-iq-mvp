/* Clip Network AI Editor v5 — semantic + multimodal timeline director.
 * Plans only. The Fly worker renders the recommended plan; alternatives stay as JSON.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const WORKER_SECRET = Deno.env.get("CLIP_WORKER_SECRET") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const MODEL = Deno.env.get("CLIP_GEMINI_EDITOR_MODEL") || "gemini-2.5-flash";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type,x-clip-worker-secret",
  "Access-Control-Allow-Methods":"POST,OPTIONS"
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const nowIso=()=>new Date().toISOString();
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const num=(v:unknown,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clean=(v:unknown,max=160)=>String(v||"").replace(/\s+/g," ").trim().slice(0,max);

function assertWorker(req:Request){
  if(!WORKER_SECRET) throw new Error("CLIP_WORKER_SECRET não configurado");
  if((req.headers.get("x-clip-worker-secret")||"")!==WORKER_SECRET) throw new Error("unauthorized");
}

function relSegments(transcript:any,start:number,end:number){
  return (transcript?.segments||[])
    .filter((s:any)=>Number(s.end)>start&&Number(s.start)<end)
    .map((s:any)=>({
      start:Math.max(0,Number(s.start)-start),
      end:Math.min(end-start,Number(s.end)-start),
      text:clean(s.text,700)
    }));
}

function relWords(transcript:any,start:number,end:number){
  return (transcript?.words||[])
    .filter((w:any)=>Number(w.end)>start&&Number(w.start)<end)
    .map((w:any)=>({
      start:Math.max(0,Number(w.start)-start),
      end:Math.min(end-start,Number(w.end)-start),
      word:clean(w.word??w.text,80)
    }))
    .slice(0,1800);
}

function sanitizeRanges(value:any,duration:number){
  const arr=(Array.isArray(value)?value:[])
    .slice(0,20)
    .map((r:any)=>({
      start:clamp(num(r.start,0),0,duration),
      end:clamp(num(r.end,0),0,duration),
      purpose:["hook","setup","build","reaction","payoff","bridge"].includes(String(r.purpose))?String(r.purpose):"build",
      reason:clean(r.reason,140)
    }))
    .filter((r:any)=>r.end-r.start>=0.35)
    .sort((a:any,b:any)=>a.start-b.start);

  const out:any[]=[];
  for(const r of arr){
    const prev=out.at(-1);
    if(prev && r.start < prev.end-0.08){
      if(r.end<=prev.end) continue;
      r.start=prev.end;
    }
    if(r.end-r.start>=0.35) out.push(r);
  }
  if(!out.length) out.push({start:0,end:duration,purpose:"build",reason:"fallback_full_clip"});
  return out;
}

function sanitizeBeats(value:any,duration:number){
  return (Array.isArray(value)?value:[])
    .slice(0,30)
    .map((b:any)=>({
      time:clamp(num(b.time,0),0,duration),
      type:["speaker_cut","reaction","group","punch_in","punch_out","hold"].includes(String(b.type))?String(b.type):"speaker_cut",
      focus_x:b.focus_x==null?null:clamp(num(b.focus_x,.5),.03,.97),
      focus_y:b.focus_y==null?null:clamp(num(b.focus_y,.5),.05,.95),
      strength:clamp(num(b.strength,.6),0,1),
      reason:clean(b.reason,120)
    }))
    .sort((a:any,b:any)=>a.time-b.time);
}

function sanitizeHeadline(raw:any,account:any){
  const presets=["social_post","bold_top_banner","news_red_bar","clean_minimal","none"];
  const preset=presets.includes(String(raw?.preset))?String(raw.preset):"clean_minimal";
  const text=clean(raw?.text,96);
  const enabled=raw?.enabled===true && preset!=="none" && text.length>0;
  const label=clean(raw?.page_name||account?.label||"",48);
  const handle=clean(raw?.handle||account?.rules?.handle||account?.rules?.instagram_handle||"",48);
  return {
    enabled,
    preset:enabled?preset:"none",
    text:enabled?text:"",
    duration:enabled?clamp(num(raw?.duration,3),1.4,5.5):0,
    page_name:label,
    handle
  };
}

function sanitizePlan(raw:any,duration:number,account:any,id:string){
  const styles=["high_energy","storytelling","podcast_dynamic","news_react"];
  const editingStyle=styles.includes(String(raw?.editing_style))?String(raw.editing_style):"podcast_dynamic";
  const timeline=sanitizeRanges(raw?.content_timeline,duration);
  const keptDuration=timeline.reduce((s:number,r:any)=>s+(r.end-r.start),0);
  const qaRaw=raw?.qa||{};
  const qa={
    pass:qaRaw.pass===true,
    hook:clamp(num(qaRaw.hook,0),0,100),
    standalone:clamp(num(qaRaw.standalone,0),0,100),
    continuity:clamp(num(qaRaw.continuity,0),0,100),
    payoff:clamp(num(qaRaw.payoff,0),0,100),
    clarity:clamp(num(qaRaw.clarity,0),0,100),
    notes:clean(qaRaw.notes,400)
  };
  // Never let a model mark a plan healthy if its structural scores are clearly weak.
  qa.pass = qa.pass && qa.hook>=68 && qa.standalone>=72 && qa.continuity>=72 && qa.payoff>=65 && qa.clarity>=75;

  return {
    id,
    version:5,
    editing_style:editingStyle,
    viral_score:clamp(num(raw?.viral_score,0),0,100),
    confidence:clamp(num(raw?.confidence,.5),0,1),
    content_timeline:timeline,
    output_duration_estimate:Number(keptDuration.toFixed(3)),
    beats:sanitizeBeats(raw?.beats,duration),
    headline:sanitizeHeadline(raw?.headline,account),
    captions:{
      preset:["dynamic_active_word","clean_phrase","bold_phrase"].includes(String(raw?.captions?.preset))
        ?String(raw.captions.preset):"dynamic_active_word",
      max_words:clamp(Math.round(num(raw?.captions?.max_words,6)),4,8),
      position:["lower","lower_mid","center_low"].includes(String(raw?.captions?.position))
        ?String(raw.captions.position):"lower_mid",
      emphasis:["low","medium","high"].includes(String(raw?.captions?.emphasis))
        ?String(raw.captions.emphasis):"medium"
    },
    pacing:{
      target_shot_min:clamp(num(raw?.pacing?.target_shot_min,1.6),1.0,4.0),
      target_shot_max:clamp(num(raw?.pacing?.target_shot_max,3.4),1.8,6.5),
      silence_trim:raw?.pacing?.silence_trim!==false,
      pause_threshold:clamp(num(raw?.pacing?.pause_threshold,.42),.28,.85)
    },
    qa,
    rationale:clean(raw?.rationale,700)
  };
}

async function geminiVideo(input:{sourceUrl?:string;videoBase64?:string;start:number;end:number;prompt:string}){
  if(!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada");
  const isYoutube=/^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(input.sourceUrl||"");
  const videoPart:any=isYoutube?{
    fileData:{fileUri:input.sourceUrl,mimeType:"video/*"},
    videoMetadata:{startOffset:`${input.start.toFixed(3)}s`,endOffset:`${input.end.toFixed(3)}s`,fps:3}
  }:{
    inlineData:{mimeType:"video/mp4",data:String(input.videoBase64||"")},
    videoMetadata:{fps:3}
  };
  if(!isYoutube&&(!input.videoBase64||input.videoBase64.length>27_000_000)) throw new Error("visual_source_unavailable");

  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const res=await fetch(endpoint,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      systemInstruction:{parts:[{text:
        "Você é um editor sênior de short-form brasileiro. Assista ao vídeo inteiro do trecho antes de montar a edição. " +
        "Seu trabalho é criar uma timeline que pareça edição humana: história compreensível isoladamente, hook imediato, " +
        "ritmo, payoff, cortes motivados e embalagem visual coerente. Não invente falas, eventos ou contexto. Responda apenas JSON válido."
      }]},
      contents:[{role:"user",parts:[videoPart,{text:input.prompt}]}],
      generationConfig:{
        temperature:.28,
        responseMimeType:"application/json",
        maxOutputTokens:9000,
        thinkingConfig:{thinkingBudget:1800}
      }
    })
  });
  const raw=await res.text();
  if(!res.ok) throw new Error(`Gemini V5 falhou (${res.status}): ${raw.slice(0,800)}`);
  const body=JSON.parse(raw);
  const text=(body?.candidates?.[0]?.content?.parts||[])
    .filter((p:any)=>!p.thought)
    .map((p:any)=>p.text||"")
    .join("")
    .replace(/^```(?:json)?/i,"")
    .replace(/```$/i,"")
    .trim();
  if(!text) throw new Error("Gemini V5 retornou resposta vazia");
  return {raw:JSON.parse(text),method:isYoutube?"youtube_url":"inline_proxy"};
}

async function plan(payload:any,persist=true){
  const clipId=String(payload.clip_id||"");
  const revisionId=String(payload.revision_id||"");
  if(!clipId||!revisionId) throw new Error("clip_id/revision_id obrigatórios");

  const {data:clip,error:clipError}=await admin.from("clips").select("*").eq("id",clipId).maybeSingle();
  if(clipError) throw clipError;
  if(!clip) throw new Error("clip_not_found");

  const {data:video,error:videoError}=await admin.from("clip_source_videos")
    .select("transcript,title,source_url").eq("id",clip.source_video_id).maybeSingle();
  if(videoError) throw videoError;
  if(!video?.transcript) throw new Error("transcript_not_ready");

  const {data:account}=await admin.from("clip_accounts")
    .select("label,niche,tone,rules").eq("id",clip.clip_account_id).maybeSingle();

  const {data:revision,error:revisionError}=await admin.from("clip_revisions")
    .select("*").eq("id",revisionId).eq("clip_id",clipId).maybeSingle();
  if(revisionError) throw revisionError;
  if(!revision) throw new Error("revision_not_found");

  const start=num(clip.start_seconds),end=num(clip.end_seconds),duration=end-start;
  if(duration<=0) throw new Error("clip_duration_invalid");

  const segments=relSegments(video.transcript,start,end);
  const words=relWords(video.transcript,start,end);
  const styleHint=clip?.editorial_meta?.edit_hint||{};
  const contentType=clean(clip?.editorial_meta?.content_type||"",40);

  const prompt=[
    "OBJETIVO: produzir UM short que pareça editado manualmente e maximize retenção sem destruir o sentido.",
    "TIMESTAMPS: todos RELATIVOS ao início do corte. Não use timestamps absolutos do vídeo-fonte.",
    "",
    "HISTÓRIA:",
    "- O vídeo final precisa ter hook, setup suficiente, desenvolvimento e payoff.",
    "- Pode remover gordura, silêncio, hesitação e repetições, mas NÃO pode montar uma frase que a pessoa nunca disse.",
    "- content_timeline é a sequência de ranges que ficam. Mantenha ordem cronológica nesta versão.",
    "- Evite microcortes menores que 0.35s e jump cuts sem motivo.",
    "- Preferência final: 15–55s; não encurte se perder payoff.",
    "",
    "RITMO VISUAL:",
    "- speaker_cut = troca de pessoa/plano motivada por speaker.",
    "- reaction = reação visual que acrescenta humor/tensão; informe focus_x/focus_y aproximados no frame ORIGINAL.",
    "- group = plano mais aberto quando duas pessoas importam.",
    "- punch_in/punch_out = mudança de escala motivada por ênfase, revelação ou mudança de energia.",
    "- Em high_energy, decisão visual geralmente a cada ~1.4–3s. Storytelling pode respirar mais.",
    "- Não invente reação se não estiver visível.",
    "",
    "HEADLINE / EMBALAGEM:",
    "- A headline é opcional; enabled=false quando o áudio já se sustenta.",
    "- Escolha SOMENTE entre social_post, bold_top_banner, news_red_bar, clean_minimal ou none.",
    "- social_post: aparência de post/página viral com nome/handle e headline em card branco.",
    "- bold_top_banner: faixa branca com texto preto bold/itálico, hype.",
    "- news_red_bar: tarja vermelha com texto branco em caixa alta, notícia/contexto.",
    "- clean_minimal: headline discreta e premium, sem faixa pesada.",
    "- Não repita literalmente a primeira legenda. Ela precisa acrescentar contexto/curiosidade.",
    "",
    "CRIE 3 PLANOS EM JSON: recommended, fast e story.",
    "- recommended = melhor equilíbrio e deve ser o que renderizamos.",
    "- fast = mais agressivo/dinâmico, mas ainda coerente.",
    "- story = mais contexto e payoff.",
    "- NÃO renderizamos fast/story agora; guardamos para o usuário pedir outra versão depois.",
    "",
    "QA: avalie 0–100 hook, standalone, continuity, payoff e clarity. pass=true somente se você publicaria sem explicar contexto.",
    "",
    `CONTA: ${account?.label||""} | nicho=${account?.niche||""} | tom=${account?.tone||""} | regras=${JSON.stringify(account?.rules||{})}`,
    `TIPO EDITORIAL: ${contentType} | hint=${JSON.stringify(styleHint)}`,
    `VÍDEO: ${video.title||""}`,
    `DURAÇÃO: ${duration.toFixed(3)}s`,
    `HEADLINE EXISTENTE: ${clip.on_screen_title||""}`,
    "TRANSCRIÇÃO POR SEGMENTO:",JSON.stringify(segments),
    "PALAVRAS/TIMING:",JSON.stringify(words),
    "",
    'FORMATO EXATO:',
    '{"recommended":{"editing_style":"podcast_dynamic","viral_score":86,"confidence":0.9,"content_timeline":[{"start":0.4,"end":8.2,"purpose":"hook","reason":"..."},{"start":8.5,"end":31.0,"purpose":"build","reason":"..."},{"start":31.0,"end":42.0,"purpose":"payoff","reason":"..."}],"beats":[{"time":3.0,"type":"punch_in","strength":0.8,"reason":"frase forte"},{"time":11.5,"type":"reaction","focus_x":0.72,"focus_y":0.45,"strength":0.8,"reason":"reação visível"}],"headline":{"enabled":true,"preset":"bold_top_banner","text":"...","duration":3.2},"captions":{"preset":"dynamic_active_word","max_words":6,"position":"lower_mid","emphasis":"high"},"pacing":{"target_shot_min":1.5,"target_shot_max":3.1,"silence_trim":true,"pause_threshold":0.42},"qa":{"pass":true,"hook":88,"standalone":91,"continuity":90,"payoff":85,"clarity":93,"notes":"..."},"rationale":"..."},"fast":{...mesma estrutura...},"story":{...mesma estrutura...}}'
  ].join("\n");

  const generated=await geminiVideo({
    sourceUrl:video.source_url||"",
    videoBase64:String(payload.video_base64||""),
    start,end,prompt
  });
  const raw=generated.raw||{};
  const recommended=sanitizePlan(raw.recommended,duration,account,"recommended");
  const fast=sanitizePlan(raw.fast,duration,account,"fast");
  const story=sanitizePlan(raw.story,duration,account,"story");

  // If recommended failed its own QA, choose the strongest alternative that passes.
  const passing=[recommended,fast,story]
    .filter((p:any)=>p.qa.pass)
    .sort((a:any,b:any)=>b.viral_score-a.viral_score);
  const selected=passing[0]||recommended;
  const alternatives=[recommended,fast,story].filter((p:any)=>p.id!==selected.id);

  const result={
    version:5,
    editor:"ai_editor_v5_semantic_multimodal",
    model:MODEL,
    visual_source_method:generated.method,
    selected_plan_id:selected.id,
    recommended:{...selected,id:"recommended"},
    alternatives,
    original_candidate_ids:["recommended","fast","story"],
    generated_at:nowIso()
  };

  if(persist){
    const nextParams={
      ...(revision.parameters||{}),
      editor:"ai_editor_v5_semantic_multimodal",
      editor_version:5,
      v5_plan:result,
      headline_preset:result.recommended.headline,
      editing_style:result.recommended.editing_style,
      updated_by_v5_at:nowIso()
    };
    const {error:updateError}=await admin.from("clip_revisions").update({
      parameters:nextParams,
      interpreted_action:{
        type:"semantic_multimodal_edit_v5",
        summary:`V5 ${result.recommended.editing_style}; ${result.recommended.output_duration_estimate}s; headline=${result.recommended.headline.preset}`
      },
      updated_at:nowIso()
    }).eq("id",revisionId);
    if(updateError) throw updateError;
  }
  return {ok:true,persisted:persist,...result};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  try{
    assertWorker(req);
    const {action,payload={}}=await req.json();
    if(action==="ping") return json({
      ok:true,version:5,model:MODEL,
      presets:["social_post","bold_top_banner","news_red_bar","clean_minimal"],
      editing_styles:["high_energy","storytelling","podcast_dynamic","news_react"],
      alternatives:2
    });
    if(action==="plan") return json(await plan(payload,true));
    if(action==="plan_dry") return json(await plan(payload,false));
    return json({error:"unknown_action"},400);
  }catch(error){
    const message=String((error as Error)?.message||error);
    return json({error:message},message==="unauthorized"?401:500);
  }
});
