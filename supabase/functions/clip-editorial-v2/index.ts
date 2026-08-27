import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const WORKER_SECRET=Deno.env.get("CLIP_WORKER_SECRET")||"";
const OPENAI_API_KEY=Deno.env.get("OPENAI_API_KEY")||"";
const MODEL=Deno.env.get("CLIP_OPENAI_MODEL")||"gpt-5.4-mini";

const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-clip-worker-secret","Access-Control-Allow-Methods":"POST,OPTIONS"};
const nowIso=()=>new Date().toISOString();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function assertWorker(req){
  if(!WORKER_SECRET)throw new Error("CLIP_WORKER_SECRET não configurado");
  if((req.headers.get("x-clip-worker-secret")||"")!==WORKER_SECRET)throw new Error("unauthorized");
}
function parseJsonLoose(text){
  return JSON.parse(String(text||"").replace(/^```(?:json)?/i,"").replace(/```$/i,"").trim()||"{}");
}
async function aiJson(system,prompt,timeoutMs=45000){
  if(!OPENAI_API_KEY)throw new Error("OPENAI_API_KEY não configurada");
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const r=await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",signal:c.signal,
      headers:{Authorization:`Bearer ${OPENAI_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:MODEL,response_format:{type:"json_object"},messages:[{role:"system",content:system},{role:"user",content:prompt}]})
    });
    const raw=await r.text();
    if(!r.ok)throw new Error(`OpenAI (${MODEL}) falhou (${r.status}): ${raw.slice(0,500)}`);
    const body=JSON.parse(raw);
    return parseJsonLoose(body?.choices?.[0]?.message?.content||"{}");
  } finally { clearTimeout(t); }
}

const ts=segments=>segments.map(s=>`[${Number(s.start).toFixed(1)}-${Number(s.end).toFixed(1)}] ${String(s.text||"").trim()}`).join("\n");
const excerpt=(segments,start,end,pad=0,max=9000)=>segments
  .filter(s=>Number(s.end)>start-pad&&Number(s.start)<end+pad)
  .map(s=>`[${Number(s.start).toFixed(1)}-${Number(s.end).toFixed(1)}] ${String(s.text||"").trim()}`)
  .join("\n").slice(0,max);
const overlap=(a,b,pad=5)=>Number(a.start_seconds)<Number(b.end_seconds)+pad&&Number(a.end_seconds)>Number(b.start_seconds)-pad;

function validRange(c,duration){
  const s=Number(c.start_seconds),e=Number(c.end_seconds),d=e-s;
  return Number.isFinite(s)&&Number.isFinite(e)&&s>=0&&e<=duration+2&&d>=12&&d<=80;
}
function snapStart(segments,t,lo,hi){
  const c=segments.map(s=>Number(s.start)).filter(x=>x>=lo&&x<=hi);
  if(!c.length)return clamp(t,lo,hi);
  return c.reduce((b,x)=>Math.abs(x-t)<Math.abs(b-t)?x:b);
}
function snapEnd(segments,t,lo,hi){
  const c=segments.map(s=>Number(s.end)).filter(x=>x>=lo&&x<=hi);
  if(!c.length)return clamp(t,lo,hi);
  return c.reduce((b,x)=>Math.abs(x-t)<Math.abs(b-t)?x:b);
}

function mmEvents(multimodal){
  return Array.isArray(multimodal?.events)?multimodal.events:[];
}
function compactEvent(e){
  return {
    t:Number(e.time)||0,
    type:String(e.type||""),
    score:Number(e.score)||0,
    faces:Number(e.faces)||0,
    group:Boolean(e.group_shot),
    close:Boolean(e.close_up),
    happiness:Number(e.happiness)||0,
    surprise:Number(e.surprise)||0,
    anger:Number(e.anger)||0,
    disgust:Number(e.disgust)||0,
    fear:Number(e.fear)||0,
    contempt:Number(e.contempt)||0,
    expression_change:Number(e.emotion_change)||0,
    audio_energy:Number(e.audio_energy)||0,
    audio_delta:Number(e.audio_delta)||0,
    scene_diff:Number(e.scene_diff)||0,
  };
}
function eventsNear(multimodal,start,end,pad=0,max=90){
  return mmEvents(multimodal)
    .filter(e=>Number(e.time)>=start-pad&&Number(e.time)<=end+pad)
    .sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0))
    .slice(0,max)
    .sort((a,b)=>Number(a.time)-Number(b.time))
    .map(compactEvent);
}
function mmDiscoveryHints(multimodal,duration){
  const useful=new Set(["facial_reaction","group_reaction","laughter_candidate","tension_expression","audio_spike","sudden_pause","face_count_change"]);
  const raw=mmEvents(multimodal)
    .filter(e=>useful.has(String(e.type))&&(Number(e.score)||0)>=0.55)
    .sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0));
  const out=[];
  for(const e of raw){
    const t=clamp(Number(e.time)||0,0,duration);
    if(out.some(x=>Math.abs(x.t-t)<7&&x.type===e.type))continue;
    out.push(compactEvent(e));
    if(out.length>=180)break;
  }
  return out.sort((a,b)=>a.t-b.t);
}
function mmSyntheticAnchors(multimodal,duration){
  const weights={
    group_reaction:1.0,facial_reaction:.95,laughter_candidate:1.0,
    tension_expression:.78,audio_spike:.58,sudden_pause:.62,face_count_change:.42
  };
  return mmEvents(multimodal)
    .filter(e=>weights[String(e.type)]&&(Number(e.score)||0)>=0.62)
    .map(e=>{
      const w=weights[String(e.type)]||.5;
      const s=clamp((Number(e.score)||0)*100,0,100);
      return {
        anchor_time:clamp(Number(e.time)||0,0,duration),
        moment_type:`visual_${String(e.type)}`,
        why:`sinal multimodal ${String(e.type)}`,
        comedy_score:clamp(s*w,0,100),
        story_potential_score:clamp(52+s*.4,0,100),
        multimodal_anchor:true
      };
    });
}
function speechFeatures(segments,start,end){
  const local=segments.filter(s=>Number(s.end)>start&&Number(s.start)<end);
  const duration=Math.max(.1,end-start);
  const words=local.reduce((n,s)=>n+String(s.text||"").trim().split(/\s+/).filter(Boolean).length,0);
  let pauses=0,maxPause=0,speakerSwitches=0,prevSpeaker=null,prevEnd=null;
  for(const s of local){
    const st=Number(s.start),en=Number(s.end);
    if(Number.isFinite(prevEnd)&&st-prevEnd>=.42){pauses++;maxPause=Math.max(maxPause,st-prevEnd)}
    prevEnd=en;
    const sp=s.speaker_id??s.speaker??null;
    if(sp!=null&&prevSpeaker!=null&&sp!==prevSpeaker)speakerSwitches++;
    if(sp!=null)prevSpeaker=sp;
  }
  return {
    speech_rate_wps:Number((words/duration).toFixed(2)),
    pause_count:pauses,
    max_pause_s:Number(maxPause.toFixed(2)),
    speaker_switches:speakerSwitches
  };
}
function mmEvidence(multimodal,start,end){
  const events=eventsNear(multimodal,start,end,0,120);
  const types={};
  let maxReaction=0,maxLaugh=0,maxTension=0,maxAudio=0,maxExpr=0,groupReactions=0;
  for(const e of events){
    types[e.type]=(types[e.type]||0)+1;
    if(e.type==="facial_reaction"||e.type==="group_reaction")maxReaction=Math.max(maxReaction,e.score);
    if(e.type==="group_reaction")groupReactions++;
    if(e.type==="laughter_candidate")maxLaugh=Math.max(maxLaugh,e.score);
    if(e.type==="tension_expression")maxTension=Math.max(maxTension,e.score);
    if(e.type==="audio_spike")maxAudio=Math.max(maxAudio,e.score);
    maxExpr=Math.max(maxExpr,e.expression_change||0);
  }
  const score=clamp(Math.round(
    100*(.30*maxReaction+.25*maxLaugh+.13*maxTension+.10*maxAudio+.16*clamp(maxExpr*4,0,1)+.06*clamp(groupReactions/3,0,1))
  ),0,100);
  return {
    available:events.length>0,
    score,
    event_count:events.length,
    type_counts:types,
    max_reaction:Number(maxReaction.toFixed(3)),
    max_laughter:Number(maxLaugh.toFixed(3)),
    max_tension:Number(maxTension.toFixed(3)),
    max_expression_change:Number(maxExpr.toFixed(3)),
    top_events:[...events].sort((a,b)=>b.score-a.score).slice(0,10).sort((a,b)=>a.t-b.t)
  };
}

async function scout(segments,title,multimodal,duration){
  const hints=mmDiscoveryHints(multimodal,duration);
  const prompt=[
    "Encontre NÚCLEOS DE ACONTECIMENTO para vídeos curtos. Não escolha início/fim final ainda.",
    "Prioridade: humor, zoeira, reação, constrangimento, provocação, absurdo e surpresa. Depois histórias fortes com payoff. Informação pura é baixa prioridade.",
    "Busque 12 a 18 âncoras reais e variadas. Pode retornar menos se o material for fraco.",
    "anchor_time é o centro do acontecimento. Não invente fala nem evento.",
    "Os SINAIS MULTIMODAIS são evidência objetiva do vídeo: rostos/reação/emoção/áudio/cena. Use-os para achar reações que a transcrição não mostra, mas não invente o motivo sem suporte textual.",
    `Título=${title||""}`,
    `SINAIS_MULTIMODAIS=${JSON.stringify(hints)}`,
    ts(segments).slice(0,220000),
    'JSON {"anchors":[{"anchor_time":100,"moment_type":"humor_reacao","why":"","comedy_score":90,"story_potential_score":88}]}'
  ].join("\n");
  const o=await aiJson("Você é um scout de comédia e micro-histórias multimodal para Reels e Shorts. Responda apenas JSON.",prompt);
  return Array.isArray(o?.anchors)?o.anchors:[];
}
function selectAnchors(raw,duration){
  const items=raw.map(x=>({
    ...x,
    anchor_time:clamp(Number(x.anchor_time),0,duration),
    comedy_score:clamp(Number(x.comedy_score)||0,0,100),
    story_potential_score:clamp(Number(x.story_potential_score)||0,0,100)
  })).filter(x=>Number.isFinite(x.anchor_time))
    .sort((a,b)=>(b.comedy_score*1.35+b.story_potential_score)-(a.comedy_score*1.35+a.story_potential_score));
  const out=[];
  for(const x of items){
    if(out.some(y=>Math.abs(y.anchor_time-x.anchor_time)<18))continue;
    out.push(x);
    if(out.length>=14)break;
  }
  return out.sort((a,b)=>a.anchor_time-b.anchor_time);
}

async function buildStories(anchors,segments,duration,multimodal){
  const windows=anchors.map((a,i)=>{
    const a0=Math.max(0,a.anchor_time-65),b0=Math.min(duration,a.anchor_time+65);
    return {
      anchor_index:i,anchor_time:a.anchor_time,moment_type:a.moment_type||"",
      comedy_hint:a.comedy_score,story_hint:a.story_potential_score,
      context:excerpt(segments,a0,b0,0,12000),
      speech_features:speechFeatures(segments,a0,b0),
      multimodal_events:eventsNear(multimodal,a0,b0,0,60)
    };
  });
  const prompt=[
    "Para cada âncora, encontre a MENOR história completa dentro do contexto fornecido.",
    "Obrigatório: começo natural/contexto mínimo suficiente -> desenvolvimento/escalada -> payoff -> reação/fechamento quando necessária.",
    "Não comece no meio de uma referência que exige o que veio antes. Não termine antes do payoff ou da reação que dá sentido.",
    "Duração 12-75s. Priorize momentos cômicos. Rejeite conversa genérica ou trecho sem final.",
    "Use multimodal_events para localizar risadas, expressões, grupo reagindo, pausas, picos de áudio e mudanças de cena. Uma reação forte DEPOIS do payoff pode ser parte obrigatória do fim.",
    "Não use emoção facial como prova sem contexto; ela é sinal auxiliar.",
    "Notas independentes 0-100: context_score, comedy_score, payoff_score, reaction_score, standalone_score, story_completeness_score. 90+ deve ser raro.",
    JSON.stringify(windows),
    'JSON {"stories":[{"anchor_index":0,"reject":false,"start_seconds":90,"end_seconds":130,"moment_type":"humor_reacao","topic":"","hook":"fala real inicial","on_screen_title":"","context_score":85,"comedy_score":90,"payoff_score":88,"reaction_score":84,"standalone_score":88,"story_completeness_score":90,"reason":""}]}'
  ].join("\n");
  const o=await aiJson("Você constrói micro-histórias completas multimodais para short-form. Não tente salvar material mediano. Responda apenas JSON.",prompt);
  return Array.isArray(o?.stories)?o.stories:[];
}
function builderGate(s,duration){
  if(s.reject===true||!validRange(s,duration))return false;
  const comedy=Number(s.comedy_score)||0,story=Number(s.story_completeness_score)||0,standalone=Number(s.standalone_score)||0,payoff=Number(s.payoff_score)||0,context=Number(s.context_score)||0;
  const exceptional=story>=90&&payoff>=85&&standalone>=86;
  return context>=76&&standalone>=78&&payoff>=75&&story>=78&&(comedy>=78||exceptional);
}

async function independentQa(candidates,segments,duration,multimodal){
  const payload=candidates.map((c,i)=>({
    candidate_index:i,start_seconds:c.start_seconds,end_seconds:c.end_seconds,
    before_15s:excerpt(segments,Math.max(0,c.start_seconds-15),c.start_seconds,0,2800),
    proposed_cut:excerpt(segments,c.start_seconds,c.end_seconds,0,9000),
    after_15s:excerpt(segments,c.end_seconds,Math.min(duration,c.end_seconds+15),0,2800),
    speech_features:speechFeatures(segments,c.start_seconds,c.end_seconds),
    multimodal_before:eventsNear(multimodal,Math.max(0,c.start_seconds-8),c.start_seconds,0,20),
    multimodal_inside:eventsNear(multimodal,c.start_seconds,c.end_seconds,0,60),
    multimodal_after:eventsNear(multimodal,c.end_seconds,Math.min(duration,c.end_seconds+8),0,20)
  }));
  const prompt=[
    "Você é o QA FINAL independente. Não conhece as notas do editor anterior.",
    "Confirme começo natural, contexto suficiente, progressão clara, payoff completo, reação necessária e entendimento standalone.",
    "Os eventos multimodais indicam reações faciais, risada provável, tensão, áudio, pausas e cenas. Verifique se a reação que completa a piada está DENTRO do corte.",
    "Se um forte evento de reação ocorrer nos 8s após o final e fizer parte do mesmo payoff, estenda o fim até ele.",
    "Se faltar somente até 15s antes/depois, corrija os limites usando timestamps existentes. Se ainda não fechar, reprove.",
    "Não alongue depois que a piada terminou. pass=true somente com qa_score >= 80.",
    JSON.stringify(payload),
    'JSON {"qa":[{"candidate_index":0,"pass":true,"qa_score":86,"start_seconds":90,"end_seconds":130,"standalone":true,"payoff_complete":true,"reason":""}]}'
  ].join("\n");
  const o=await aiJson("Você é um editor-chefe multimodal seletivo. Aprove apenas cortes que alguém realmente postaria. Responda apenas JSON.",prompt);
  return Array.isArray(o?.qa)?o.qa:[];
}

async function routeAccounts(candidates,accounts){
  if(!candidates.length)return[];
  const fallback=accounts.find(a=>a.rules?.fallback===true||a.rules?.general===true)||accounts[0];
  if(accounts.length===1)return candidates.map(c=>({...c,account_id:fallback.id}));
  const prompt=[
    "Roteie cada corte aprovado para exatamente uma conta editorial ativa. Não altere timestamps e não descarte cortes.",
    "CONTAS:",...accounts.map(a=>`id=${a.id} | ${a.label} | nicho=${a.niche||""} | tom=${a.tone||""} | regras=${JSON.stringify(a.rules||{})}`),
    "CORTES:",...candidates.map((c,i)=>`${i}: ${JSON.stringify({topic:c.topic,moment_type:c.moment_type,hook:c.hook,score:c.score})}`),
    'JSON {"routes":[{"candidate_index":0,"account_id":"uuid"}]}'
  ].join("\n");
  const o=await aiJson("Você faz somente routing editorial. Responda apenas JSON.",prompt,30000),ids=new Set(accounts.map(a=>a.id)),routes=new Map();
  for(const r of o.routes||[]){const i=Number(r.candidate_index);if(Number.isInteger(i)&&ids.has(r.account_id))routes.set(i,r.account_id)}
  return candidates.map((c,i)=>({...c,account_id:routes.get(i)||fallback.id}));
}

async function analyzeAndSave(job,transcript,multimodal){
  const segments=Array.isArray(transcript?.segments)?transcript.segments:[];
  const duration=Number(job?.duration_seconds)||Number(transcript?.duration)||Number(segments.at(-1)?.end)||0;
  if(!job?.id||!job?.user_id||!job?.source_id||!segments.length||!duration)throw new Error("job/transcript inválido para Editorial v3.1");

  const {data:source,error:se}=await admin.from("clip_sources").select("*").eq("id",job.source_id).maybeSingle();
  if(se)throw se;if(!source)throw new Error("source_not_found");
  const {data:network,error:ne}=await admin.from("clip_networks").select("*").eq("id",source.network_id).maybeSingle();
  if(ne)throw ne;if(!network)throw new Error("network_not_found");
  const {data:accounts,error:ae}=await admin.from("clip_accounts").select("*").eq("network_id",network.id).eq("active",true);
  if(ae)throw ae;if(!accounts?.length)throw new Error("no_active_accounts");

  const rawAnchors=await scout(segments,job.title,multimodal,duration);
  const anchors=selectAnchors([...rawAnchors,...mmSyntheticAnchors(multimodal,duration)],duration);
  const raw=await buildStories(anchors,segments,duration,multimodal);
  const built=raw.map(x=>({
      ...x,anchor_index:Number(x.anchor_index),
      start_seconds:clamp(Number(x.start_seconds),0,duration),
      end_seconds:clamp(Number(x.end_seconds),0,duration)
    }))
    .filter(x=>Number.isInteger(x.anchor_index)&&builderGate(x,duration))
    .sort((a,b)=>(Number(b.comedy_score)*.35+Number(b.story_completeness_score)*.25+Number(b.payoff_score)*.2+Number(b.standalone_score)*.2)
      -(Number(a.comedy_score)*.35+Number(a.story_completeness_score)*.25+Number(a.payoff_score)*.2+Number(a.standalone_score)*.2));

  const distinct=[];
  for(const c of built){
    if(distinct.some(x=>overlap(c,x)))continue;
    distinct.push(c);
    if(distinct.length>=8)break;
  }

  const qa=await independentQa(distinct,segments,duration,multimodal),qualified=[];
  for(const q of qa){
    const c=distinct[Number(q.candidate_index)];
    if(!c||q.pass!==true||Number(q.qa_score)<80||q.standalone===false||q.payoff_complete===false)continue;
    let start=Number(q.start_seconds),end=Number(q.end_seconds);
    if(!Number.isFinite(start))start=c.start_seconds;
    if(!Number.isFinite(end))end=c.end_seconds;
    start=snapStart(segments,start,Math.max(0,c.start_seconds-15),Math.min(c.end_seconds-6,c.start_seconds+15));
    end=snapEnd(segments,end,Math.max(start+12,c.end_seconds-15),Math.min(duration,c.end_seconds+15));
    if(!validRange({start_seconds:start,end_seconds:end},duration))continue;

    const evidence=mmEvidence(multimodal,start,end);
    const mmWeight=evidence.available?.10:0;
    const baseWeight=1-mmWeight;
    const baseScore=Number(q.qa_score)*.4+Number(c.comedy_score)*.25+Number(c.payoff_score)*.15+Number(c.story_completeness_score)*.2;
    const score=Math.round(baseScore*baseWeight+evidence.score*mmWeight);
    const row={...c,start_seconds:start,end_seconds:end,qa_score:Number(q.qa_score),qa_reason:String(q.reason||""),score,multimodal_evidence:evidence};
    if(qualified.some(x=>overlap(row,x)))continue;
    qualified.push(row);
    if(qualified.length>=6)break;
  }

  const routed=await routeAccounts(qualified,accounts);
  const proposed=routed.map(c=>({
    user_id:job.user_id,source_video_id:job.id,clip_account_id:c.account_id,
    dedupe_key:`editorial-v3.1:${Math.round(c.start_seconds*10)}:${Math.round(c.end_seconds*10)}`,
    start_seconds:c.start_seconds,end_seconds:c.end_seconds,
    transcript_excerpt:excerpt(segments,c.start_seconds,c.end_seconds,0,4500).replace(/^\[[^\]]+\]\s?/gm,"").replace(/\n/g," ").slice(0,4500),
    topic:String(c.topic||c.moment_type||"Momento"),
    hook:String(c.hook||"").slice(0,700)||null,
    on_screen_title:String(c.on_screen_title||"").slice(0,120)||null,
    caption:null,score:clamp(c.score,0,100),
    ai_reason:`Story Engine v3.1 multimodal: ${String(c.reason||"")} QA: ${c.qa_reason}`.slice(0,2000),
    editorial_meta:{
      version:3.1,moment_type:c.moment_type||null,
      scores:{
        context:Number(c.context_score)||0,comedy:Number(c.comedy_score)||0,payoff:Number(c.payoff_score)||0,
        reaction:Number(c.reaction_score)||0,standalone:Number(c.standalone_score)||0,
        story_completeness:Number(c.story_completeness_score)||0,qa:Number(c.qa_score)||0,
        multimodal:Number(c.multimodal_evidence?.score)||0
      },
      structure:{setup:true,development:true,payoff:true,reaction_checked:true},
      multimodal:{
        available:Boolean(c.multimodal_evidence?.available),
        version:multimodal?.version||null,
        backend:multimodal?.backend||null,
        evidence:c.multimodal_evidence||null
      },
      speech:speechFeatures(segments,c.start_seconds,c.end_seconds),
      selection_policy:{qa_min:80,comedy_priority:true,max_final:6,no_weak_fallback:true,multimodal_bonus_max:10},
      selected_at:nowIso()
    },
    status:"candidate",render_status:"pending",updated_at:nowIso()
  }));

  const {data:existing,error:ee}=await admin.from("clips").select("id,dedupe_key,start_seconds,end_seconds,status").eq("source_video_id",job.id).eq("user_id",job.user_id);
  if(ee)throw ee;
  const keys=new Set((existing||[]).map(x=>x.dedupe_key).filter(Boolean));
  const ranges=(existing||[]).map(x=>({start_seconds:Number(x.start_seconds),end_seconds:Number(x.end_seconds)})),fresh=[];
  for(const row of proposed){
    if(keys.has(row.dedupe_key)||ranges.some(x=>overlap(row,x,4)))continue;
    fresh.push(row);keys.add(row.dedupe_key);ranges.push(row);
  }
  if(fresh.length){const {error}=await admin.from("clips").insert(fresh);if(error)throw error}
  const {data:all,error:allE}=await admin.from("clips").select("*").eq("source_video_id",job.id).eq("user_id",job.user_id).neq("status","rejected").order("score",{ascending:false});
  if(allE)throw allE;

  return{
    clips:all||[],new_clips:fresh.length,approved:[],variants:[],revisions:[],
    editorial_version:3.1,threshold:80,anchors_count:anchors.length,built_count:distinct.length,
    qa_count:qa.length,final_count:qualified.length,preserved_existing:(existing||[]).length,
    multimodal:{available:mmEvents(multimodal).length>0,version:multimodal?.version||null,summary:multimodal?.summary||null}
  };
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  try{
    assertWorker(req);
    const {action,payload={}}=await req.json();
    if(action==="ping")return json({
      ok:true,version:3.1,model:MODEL,threshold:80,max_final:6,comedy_priority:true,
      story_qa:true,no_weak_fallback:true,multimodal_optional:true,
      multimodal_features:["faces","face_tracks","group_shot","close_up","8_emotions","emotion_change","audio_energy","audio_spike","sudden_pause","scene_change"]
    });
    if(action==="analyze_and_save")return json(await analyzeAndSave(payload.job,payload.transcript,payload.multimodal));
    return json({error:"unknown_action"},400);
  }catch(error){
    const message=String(error?.name==="AbortError"?"ai_timeout":error?.message||error);
    return json({error:message},message==="unauthorized"?401:500);
  }
});
