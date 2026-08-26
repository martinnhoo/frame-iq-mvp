/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types are updated by Lovable after the migration is applied. */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, CheckCircle2, Clapperboard, Clock3, Copy, Download, ExternalLink,
  Instagram, Link2, Loader2, Plus, Power, PowerOff, RefreshCw, Sparkles, Trash2, Upload, Youtube, Zap,
} from "lucide-react";

const db = supabase as any;

type Network = { id:string; user_id:string; name:string; daily_limit:number; min_score:number; approval_mode:"review"|"auto"; timezone:string; posting_slots:string[]; active:boolean };
type ClipAccount = { id:string; label:string; niche:string; tone?:string; daily_limit:number; active:boolean; rules?:any };
type Social = { id:string; clip_account_id:string; platform:"instagram"|"tiktok"; username?:string; display_name?:string; status:string; capabilities?:any };
type Source = { id:string; label:string; provider_url?:string; rights_confirmed:boolean; last_checked_at?:string; last_error?:string; active:boolean };
type SourceVideo = { id:string; source_id:string; title:string; source_url?:string; thumbnail_url?:string; source_published_at?:string; media_status:string; transcript_status:string; rights_confirmed:boolean; pipeline_stage:string; stage_detail?:string; last_error?:string; clips_generated?:number; attempts?:number; duration_seconds?:number; updated_at?:string };
type Clip = { id:string; clip_account_id:string; source_video_id?:string; hook?:string; topic?:string; caption?:string; score:number; status:string; render_status:string; rendered_url?:string; rendered_storage_path?:string; last_error?:string; scheduled_at?:string; start_seconds?:number; end_seconds?:number; on_screen_title?:string };
type Publication = { id:string; clip_id:string; platform:string; status:string; scheduled_at?:string; published_at?:string; provider_media_id?:string; error_message?:string };

const fmt = (v?:string) => v ? new Intl.DateTimeFormat("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }).format(new Date(v)) : "—";
const statusLabel: Record<string,string> = {
  candidate:"Revisar", approved:"Aprovado", scheduled:"Agendado", published:"Publicado", error:"Erro",
  pending:"Pendente", rendering:"Renderizando", ready:"Pronto", queued:"Na fila", processing:"Processando", failed:"Falhou",
};

// Os estágios da máquina, na ordem em que acontecem. O índice serve de barra de
// progresso: sem isto o painel só sabia dizer "aguardando mídia" para sempre.
const STAGES = ["discovered","downloading","transcribing","analyzing","rendering","done"] as const;
const stageLabel: Record<string,string> = {
  discovered:"Descoberto", downloading:"Baixando", transcribing:"Transcrevendo",
  analyzing:"Analisando", rendering:"Renderizando", done:"Concluído",
  error:"Erro", blocked:"Sem autorização",
};
const stageTone = (s:string):"neutral"|"good"|"warn"|"bad"|"blue" =>
  s==="done" ? "good" : s==="error" ? "bad" : s==="blocked" ? "warn" : s==="discovered" ? "neutral" : "blue";
const mmss = (s?:number) => s==null ? "—" : `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}`;


function Pill({ children, tone="neutral" }:{children:any; tone?:"neutral"|"good"|"warn"|"bad"|"blue"}) {
  const tones = { neutral:"border-white/10 bg-white/5 text-white/65", good:"border-emerald-500/20 bg-emerald-500/10 text-emerald-300", warn:"border-amber-500/20 bg-amber-500/10 text-amber-300", bad:"border-red-500/20 bg-red-500/10 text-red-300", blue:"border-sky-500/20 bg-sky-500/10 text-sky-300" };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

export default function ClipNetworkPage() {
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState<string|null>(null);
  const [error,setError] = useState<string|null>(null);
  const [network,setNetwork] = useState<Network|null>(null);
  const [accounts,setAccounts] = useState<ClipAccount[]>([]);
  const [socials,setSocials] = useState<Social[]>([]);
  const [sources,setSources] = useState<Source[]>([]);
  const [videos,setVideos] = useState<SourceVideo[]>([]);
  const [clips,setClips] = useState<Clip[]>([]);
  const [publications,setPublications] = useState<Publication[]>([]);
  const [sourceUrl,setSourceUrl] = useState("");
  const [sourceLabel,setSourceLabel] = useState("");
  const [rightsConfirmed,setRightsConfirmed] = useState(false);
  const [showSourceForm,setShowSourceForm] = useState(false);
  const [testCaption,setTestCaption] = useState("Treino de verdade é consistência. #fitness #treino");
  const fileRef = useRef<HTMLInputElement>(null);

  const primaryAccount = accounts[0];
  const instagram = socials.find(s => s.clip_account_id === primaryAccount?.id && s.platform === "instagram" && s.status === "active");
  const publicationByClip = useMemo(() => new Map(publications.map(p => [p.clip_id,p])),[publications]);
  const today = new Date().toISOString().slice(0,10);
  const publishedToday = publications.filter(p => p.status === "published" && p.published_at?.startsWith(today)).length;
  const queued = publications.filter(p => ["queued","processing","publishing"].includes(p.status)).length;
  const ready = clips.filter(c => c.render_status === "ready" || c.render_status === "not_needed").length;

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada");
      const { data:nets } = await db.from("clip_networks").select("*").eq("user_id",user.id).order("created_at",{ascending:true}).limit(1);
      const net = nets?.[0] || null; setNetwork(net);
      if (!net) { setAccounts([]); setSocials([]); setSources([]); setVideos([]); setClips([]); setPublications([]); return; }
      const [{data:acc},{data:soc},{data:src},{data:cls},{data:pub}] = await Promise.all([
        db.from("clip_accounts").select("*").eq("network_id",net.id).order("created_at"),
        db.from("clip_social_accounts").select("*").eq("user_id",user.id),
        db.from("clip_sources").select("*").eq("network_id",net.id).order("created_at"),
        db.from("clips").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(80),
        db.from("clip_publications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100),
      ]);
      setAccounts(acc||[]); setSocials(soc||[]); setSources(src||[]); setClips(cls||[]); setPublications(pub||[]);
      const sourceIds = (src||[]).map((s:any)=>s.id);
      if (sourceIds.length) {
        const {data:vids} = await db.from("clip_source_videos").select("*").in("source_id",sourceIds).order("source_published_at",{ascending:false}).limit(40);
        setVideos(vids||[]);
      } else setVideos([]);
    } catch(e:any) { setError(e.message || String(e)); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ load(); },[]);

  const createPilot = async () => {
    setBusy("pilot"); setError(null);
    try {
      const {data:{user}} = await supabase.auth.getUser(); if(!user) throw new Error("Faça login novamente");
      const {data:net,error:nErr}=await db.from("clip_networks").insert({ user_id:user.id,name:"Cariani Clip Network — Piloto",daily_limit:10,min_score:80,approval_mode:"review",timezone:"America/Sao_Paulo" }).select("*").single();
      if(nErr) throw nErr;
      const {error:aErr}=await db.from("clip_accounts").insert({ user_id:user.id,network_id:net.id,label:"Fitness Cariani",niche:"fitness, treino, dieta, rotina, transformação e hábitos para público amplo",tone:"direto, útil, orgânico e sem clickbait falso",daily_limit:10,rules:{ avoid:["fisiculturismo competitivo sem aplicação ao público geral"], prefer:["dica prática","história de transformação","frase forte sobre treino/dieta"] } });
      if(aErr) throw aErr;
      await load();
    } catch(e:any){ setError(e.message||String(e)); }
    finally{ setBusy(null); }
  };

  const addSource = async () => {
    if(!network) return;
    const label=sourceLabel.trim(); const url=sourceUrl.trim();
    if(!label||!url){setError("Informe o nome e a URL do canal do YouTube.");return;}
    const normalizedUrl=url.replace(/\/+$/,"").toLowerCase();
    if(sources.some(source=>source.provider_url?.replace(/\/+$/,"").toLowerCase()===normalizedUrl)){setError("Este canal já está cadastrado nas fontes monitoradas.");return;}
    setBusy("source"); setError(null);
    try {
      const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error("Faça login novamente");
      const {error:e}=await db.from("clip_sources").insert({ user_id:user.id,network_id:network.id,provider:"youtube",label,provider_url:url,rights_confirmed:rightsConfirmed,active:true });
      if(e) throw e;
      setSourceLabel(""); setSourceUrl(""); setRightsConfirmed(false); setShowSourceForm(false);
      await load();
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const discover = async (sourceId:string) => {
    setBusy(`discover:${sourceId}`); setError(null);
    try {
      const {data,error:e}=await supabase.functions.invoke("clip-network-discover-youtube",{body:{source_id:sourceId}});
      if(e) throw e; if(data?.error) throw new Error(data.error);
      const failure=data?.results?.find((result:any)=>result.source_id===sourceId&&result.error);
      if(failure){await load();throw new Error(failure.error);}
      if(!data?.results?.length) throw new Error("A fonte precisa estar ativa para executar a busca.");
      await load();
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const discoverAll = async () => {
    if(!network) return; setBusy("discover:all"); setError(null);
    try {
      const {data,error:e}=await supabase.functions.invoke("clip-network-discover-youtube",{body:{network_id:network.id}});
      if(e) throw e; if(data?.error) throw new Error(data.error);
      const failures=(data?.results||[]).filter((result:any)=>result.error);
      await load();
      if(failures.length) setError(`${failures.length} fonte(s) falharam na busca. Consulte o último erro em cada fonte.`);
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const toggleSource = async (source:Source) => {
    setBusy(`toggle:${source.id}`); setError(null);
    try {
      const {error:e}=await db.from("clip_sources").update({active:!source.active,updated_at:new Date().toISOString()}).eq("id",source.id);
      if(e) throw e; await load();
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const removeSource = async (source:Source) => {
    if(!window.confirm(`Remover a fonte “${source.label}”? Os vídeos descobertos por ela serão removidos do pool; cortes já criados serão preservados.`)) return;
    setBusy(`remove:${source.id}`); setError(null);
    try {
      const {error:e}=await db.from("clip_sources").delete().eq("id",source.id);
      if(e) throw e; await load();
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const connectInstagram = async () => {
    if(!primaryAccount) return; setBusy("instagram"); setError(null);
    try {
      const {data,error:e}=await supabase.functions.invoke("clip-network-instagram-oauth",{body:{action:"get_auth_url",clip_account_id:primaryAccount.id}});
      if(e) throw e; if(!data?.url) throw new Error(data?.error||"Não foi possível iniciar Instagram OAuth"); window.location.href=data.url;
    }catch(e:any){setError(e.message||String(e)); setBusy(null);}
  };

  const toggleAutopilot = async () => {
    if(!network) return; setBusy("auto");
    try { const next=network.approval_mode==="auto"?"review":"auto"; const {error:e}=await db.from("clip_networks").update({approval_mode:next,updated_at:new Date().toISOString()}).eq("id",network.id); if(e)throw e; setNetwork({...network,approval_mode:next}); }
    catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const uploadTestClip = async (file:File) => {
    if(!primaryAccount) return; setBusy("upload"); setError(null);
    try {
      const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error("Faça login novamente");
      const id=crypto.randomUUID(); const path=`${user.id}/manual-${id}.mp4`;
      const {error:upErr}=await supabase.storage.from("clip-network").upload(path,file,{contentType:file.type||"video/mp4",upsert:false}); if(upErr)throw upErr;
      const {data:pub}=supabase.storage.from("clip-network").getPublicUrl(path);
      const {data:clip,error:cErr}=await db.from("clips").insert({user_id:user.id,clip_account_id:primaryAccount.id,hook:"Teste de publicação",caption:testCaption,score:100,status:"approved",render_status:"not_needed",rendered_storage_path:path,rendered_url:pub.publicUrl}).select("*").single(); if(cErr)throw cErr;
      if(instagram){ await db.from("clip_publications").insert({user_id:user.id,clip_id:clip.id,social_account_id:instagram.id,platform:"instagram",status:"queued",scheduled_at:new Date().toISOString()}); }
      await load();
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null); if(fileRef.current)fileRef.current.value="";}
  };

  const publishNow = async (clip:Clip) => {
    if(!instagram){setError("Conecte o Instagram antes de publicar.");return;} setBusy(`publish:${clip.id}`); setError(null);
    try{
      const {data:{user}}=await supabase.auth.getUser(); if(!user)throw new Error("Faça login novamente");
      let pub=publicationByClip.get(clip.id);
      if(!pub){const {data,error:e}=await db.from("clip_publications").insert({user_id:user.id,clip_id:clip.id,social_account_id:instagram.id,platform:"instagram",status:"queued",scheduled_at:new Date().toISOString()}).select("*").single();if(e)throw e;pub=data;}
      const {data,error:e}=await supabase.functions.invoke("clip-network-publish-instagram",{body:{publication_id:pub.id,action:"publish"}});if(e)throw e;if(data?.error)throw new Error(data.error);await load();
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const approve = async (clip:Clip) => { setBusy(`approve:${clip.id}`); try{const {error:e}=await db.from("clips").update({status:"approved",updated_at:new Date().toISOString()}).eq("id",clip.id);if(e)throw e;await load();}catch(e:any){setError(e.message||String(e));}finally{setBusy(null);} };
  const reject = async (clip:Clip) => { setBusy(`reject:${clip.id}`); try{const {error:e}=await db.from("clips").update({status:"rejected",updated_at:new Date().toISOString()}).eq("id",clip.id);if(e)throw e;await load();}catch(e:any){setError(e.message||String(e));}finally{setBusy(null);} };

  if(loading) return <div className="flex min-h-[60vh] items-center justify-center text-white/60"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Carregando Clip Network…</div>;

  if(!network) return <div className="mx-auto max-w-5xl p-6 lg:p-10">
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[.07] to-white/[.02] p-8 lg:p-12">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300"><Clapperboard className="h-7 w-7"/></div>
      <h1 className="text-3xl font-semibold tracking-tight text-white">Clip Network</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">Uma fábrica de cortes dentro do AdBrief: fontes, seleção por IA, render, fila, calendário e publicação em um único painel.</p>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {[['1','1 conta piloto','Fitness, até 10 posts/dia'],['2','Qualidade primeiro','Score + revisão antes do autopilot'],['3','Escala depois','Duplica a lógica para novas contas']].map(x=><div key={x[0]} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-violet-300">{x[0]}</div><div className="mt-2 text-sm font-medium text-white">{x[1]}</div><div className="mt-1 text-xs text-white/45">{x[2]}</div></div>)}
      </div>
      <button onClick={createPilot} disabled={!!busy} className="mt-8 inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50">{busy==='pilot'?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Sparkles className="mr-2 h-4 w-4"/>}Criar piloto Cariani</button>
      {error&&<p className="mt-4 text-sm text-red-300">{error}</p>}
    </div>
  </div>;

  return <div className="mx-auto max-w-[1500px] space-y-6 p-5 lg:p-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-white">Clip Network</h1><Pill tone={network.approval_mode==='auto'?'good':'warn'}>{network.approval_mode==='auto'?'Autopilot':'Revisão manual'}</Pill></div><p className="mt-1 text-sm text-white/45">{primaryAccount?.label || network.name} · limite {network.daily_limit}/dia</p></div>
      <div className="flex flex-wrap gap-2">
        <button onClick={load} className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><RefreshCw className="mr-2 h-3.5 w-3.5"/>Atualizar</button>
        <button onClick={toggleAutopilot} disabled={busy==='auto'} className={`inline-flex items-center rounded-xl px-4 py-2 text-xs font-medium ${network.approval_mode==='auto'?'bg-emerald-500/15 text-emerald-300':'bg-violet-500 text-white'}`}><Zap className="mr-2 h-3.5 w-3.5"/>{network.approval_mode==='auto'?'Pausar autopilot':'Ativar autopilot'}</button>
      </div>
    </div>

    {error&&<div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[['Publicados hoje',publishedToday,'de '+network.daily_limit],['Fila',queued,'agendados/processando'],['Clips prontos',ready,'renderizados'],['Fontes',sources.length,'monitoradas']].map(([a,b,c])=><div key={String(a)} className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="text-xs text-white/40">{a}</div><div className="mt-2 text-2xl font-semibold text-white">{b}</div><div className="mt-1 text-[11px] text-white/35">{c}</div></div>)}
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Fila de conteúdo</h2><p className="mt-1 text-xs text-white/40">IA escolhe, você revisa — ou deixa o autopilot assumir depois.</p></div><Pill>{clips.length} clips</Pill></div>
        <div className="mt-5 space-y-3">
          {clips.length===0&&<div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/35">Nenhum corte ainda. Adicione uma fonte autorizada ou envie um clip de teste.</div>}
          {clips.slice(0,30).map(clip=>{const pub=publicationByClip.get(clip.id);return <div key={clip.id} className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_auto]">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Pill tone={clip.score>=85?'good':clip.score>=75?'blue':'neutral'}>{Math.round(clip.score)} score</Pill><Pill>{statusLabel[pub?.status||clip.status]||pub?.status||clip.status}</Pill>{clip.render_status==='ready'||clip.render_status==='not_needed'?<Pill tone="good">vídeo pronto</Pill>:<Pill>{statusLabel[clip.render_status]||clip.render_status}</Pill>}</div><div className="mt-3 text-sm font-medium text-white">{clip.on_screen_title||clip.hook||clip.topic||'Clip sem título'}</div><p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">{clip.caption||'Sem caption'}</p><div className="mt-2 flex gap-3 text-[11px] text-white/30">{clip.start_seconds!=null&&<span>{Math.round(clip.start_seconds)}s → {Math.round(clip.end_seconds||0)}s</span>}{clip.scheduled_at&&<span><Clock3 className="mr-1 inline h-3 w-3"/>{fmt(clip.scheduled_at)}</span>}</div>{pub?.error_message&&<div className="mt-2 text-xs text-red-300">{pub.error_message}</div>}</div>
            <div className="flex items-center gap-2 md:flex-col md:items-stretch md:justify-center">
              {clip.status==='candidate'&&<><button onClick={()=>approve(clip)} disabled={busy===`approve:${clip.id}`} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[11px] font-medium text-emerald-300">Aprovar</button><button onClick={()=>reject(clip)} className="rounded-lg bg-white/5 px-3 py-2 text-[11px] text-white/55">Rejeitar</button></>}
              {(clip.rendered_url)&&<><button onClick={()=>publishNow(clip)} disabled={!!busy||pub?.status==='published'} className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-black disabled:opacity-40"><Instagram className="mr-1.5 h-3.5 w-3.5"/>{pub?.status==='published'?'Publicado':'Publicar IG'}</button><a href={clip.rendered_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white/60"><Download className="mr-1.5 h-3.5 w-3.5"/>TikTok</a><button onClick={()=>navigator.clipboard.writeText(clip.caption||'')} className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white/60"><Copy className="mr-1.5 h-3.5 w-3.5"/>Caption</button></>}
            </div>
          </div>})}
        </div>
      </section>

      <div className="space-y-5">
        <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
          <h2 className="text-sm font-semibold text-white">Conta piloto</h2>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4"><div className="text-sm font-medium text-white">{primaryAccount?.label}</div><p className="mt-1 text-xs leading-5 text-white/40">{primaryAccount?.niche}</p></div>
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-orange-500/20 p-2"><Instagram className="h-4 w-4 text-pink-300"/></div><div><div className="text-xs font-medium text-white">Instagram</div><div className="text-[11px] text-white/35">{instagram?`@${instagram.username||instagram.display_name||'conectado'}`:'não conectado'}</div></div></div>{instagram?<Pill tone="good"><CheckCircle2 className="mr-1 h-3 w-3"/>API</Pill>:<button onClick={connectInstagram} disabled={busy==='instagram'} className="rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-black">Conectar</button>}</div>
          <div className="mt-2 rounded-2xl border border-white/10 p-4"><div className="flex items-center justify-between"><div><div className="text-xs font-medium text-white">TikTok</div><div className="mt-1 text-[11px] text-white/35">Exportar vídeo + caption pelo painel</div></div><Pill tone="warn">manual</Pill></div><p className="mt-3 text-[10px] leading-4 text-white/30">O Direct Post oficial não aceita o caso de uso de ferramenta interna para contas gerenciadas pela própria equipe. Mantemos a fila pronta sem arriscar bloqueio.</p></div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2"><Youtube className="h-4 w-4 text-red-400"/><h2 className="text-sm font-semibold text-white">Fontes monitoradas ({sources.length})</h2></div>
              <p className="mt-1 text-[11px] leading-4 text-white/35">Todos os vídeos entram no mesmo pool da rede para o routing editorial.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={discoverAll} disabled={!!busy||!sources.some(s=>s.active)} className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-medium text-white/65 hover:bg-white/10 disabled:opacity-40">{busy==='discover:all'?<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>:<RefreshCw className="mr-1.5 h-3.5 w-3.5"/>}Buscar todas</button>
              <button onClick={()=>setShowSourceForm(true)} disabled={showSourceForm} className="inline-flex items-center rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-black disabled:opacity-50"><Plus className="mr-1.5 h-3.5 w-3.5"/>Adicionar fonte</button>
            </div>
          </div>

          {(showSourceForm||sources.length===0)&&<div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-medium text-white">Nova fonte do YouTube</div>
            <label className="mt-3 block text-[11px] text-white/45">Nome da fonte<input value={sourceLabel} onChange={e=>setSourceLabel(e.target.value)} placeholder="Ex.: Renato Cariani" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/25"/></label>
            <label className="mt-3 block text-[11px] text-white/45">URL do canal<input value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://www.youtube.com/@canal" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/25"/></label>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] leading-4 text-white/45"><input type="checkbox" checked={rightsConfirmed} onChange={e=>setRightsConfirmed(e.target.checked)} className="mt-0.5"/><span>Tenho autorização para reutilizar/processar a mídia desta fonte. Sem isso, o AdBrief apenas monitora novos uploads.</span></label>
            <div className="mt-4 flex gap-2">
              <button onClick={addSource} disabled={busy==='source'||!sourceLabel.trim()||!sourceUrl.trim()} className="inline-flex items-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-40">{busy==='source'?<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/>:<Link2 className="mr-2 h-3.5 w-3.5"/>}Adicionar fonte</button>
              {sources.length>0&&<button onClick={()=>setShowSourceForm(false)} disabled={busy==='source'} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55">Cancelar</button>}
            </div>
          </div>}

          <div className="mt-4 space-y-3">
            {sources.length===0&&<div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-white/35">Nenhuma fonte monitorada ainda.</div>}
            {sources.map(s=><div key={s.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><div className="text-xs font-medium text-white">{s.label}</div><Pill tone={s.active?'good':'neutral'}>{s.active?'ativo':'inativo'}</Pill></div>
                  {s.provider_url?<a href={s.provider_url} target="_blank" rel="noreferrer" className="mt-1.5 flex items-center gap-1 truncate text-[10px] text-sky-300/70 hover:text-sky-300"><span className="truncate">{s.provider_url}</span><ExternalLink className="h-3 w-3 shrink-0"/></a>:<div className="mt-1.5 text-[10px] text-white/25">Canal não informado</div>}
                </div>
                <Pill tone={s.rights_confirmed?'good':'warn'}>{s.rights_confirmed?'autorizada':'somente monitorar'}</Pill>
              </div>
              <div className="mt-3 text-[10px] text-white/35">Último scan: {fmt(s.last_checked_at)}</div>
              {s.last_error&&<div className="mt-2 rounded-lg border border-red-500/15 bg-red-500/10 px-2.5 py-2 text-[10px] leading-4 text-red-300">Último erro: {s.last_error}</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={()=>discover(s.id)} disabled={!!busy||!s.active} className="inline-flex items-center rounded-lg bg-white/10 px-2.5 py-2 text-[10px] font-medium text-white/70 hover:bg-white/15 disabled:opacity-35">{busy===`discover:${s.id}`?<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>:<RefreshCw className="mr-1.5 h-3.5 w-3.5"/>}Buscar agora</button>
                <button onClick={()=>toggleSource(s)} disabled={!!busy} className="inline-flex items-center rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-white/55 hover:bg-white/5 disabled:opacity-35">{busy===`toggle:${s.id}`?<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>:s.active?<PowerOff className="mr-1.5 h-3.5 w-3.5"/>:<Power className="mr-1.5 h-3.5 w-3.5"/>}{s.active?'Desativar':'Ativar'}</button>
                <button onClick={()=>removeSource(s)} disabled={!!busy} className="ml-auto inline-flex items-center rounded-lg border border-red-500/15 px-2.5 py-2 text-[10px] text-red-300/70 hover:bg-red-500/10 disabled:opacity-35">{busy===`remove:${s.id}`?<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>:<Trash2 className="mr-1.5 h-3.5 w-3.5"/>}Remover</button>
              </div>
            </div>)}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
          <h2 className="text-sm font-semibold text-white">Teste rápido da publicação</h2><p className="mt-1 text-xs leading-5 text-white/40">Suba um MP4 vertical pronto para validar a conexão Instagram antes do crawler/worker.</p>
          <textarea value={testCaption} onChange={e=>setTestCaption(e.target.value)} rows={3} className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white outline-none"/>
          <input ref={fileRef} type="file" accept="video/mp4,video/quicktime" className="hidden" onChange={e=>e.target.files?.[0]&&uploadTestClip(e.target.files[0])}/>
          <button onClick={()=>fileRef.current?.click()} disabled={busy==='upload'} className="mt-3 inline-flex items-center rounded-xl bg-violet-500 px-3 py-2 text-xs font-medium text-white">{busy==='upload'?<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/>:<Upload className="mr-2 h-3.5 w-3.5"/>}Enviar MP4 de teste</button>
        </section>
      </div>
    </div>

    <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Últimos vídeos encontrados</h2><p className="mt-1 text-xs text-white/40">O watcher descobre uploads; processamento só começa quando existe mídia autorizada.</p></div><Pill>{videos.length}</Pill></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{videos.slice(0,8).map(v=><a key={v.id} href={v.source_url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-white/10 bg-black/20">{v.thumbnail_url?<img src={v.thumbnail_url} className="aspect-video w-full object-cover opacity-80 transition group-hover:opacity-100"/>:<div className="aspect-video bg-white/5"/>}<div className="p-3"><div className="line-clamp-2 text-xs font-medium leading-5 text-white">{v.title}</div><div className="mt-2 flex gap-2"><Pill tone={v.media_status==='processed'?'good':v.rights_confirmed?'blue':'warn'}>{v.media_status==='waiting_for_media'?'aguardando mídia':v.media_status}</Pill><ExternalLink className="ml-auto h-3.5 w-3.5 text-white/25"/></div></div></a>)}</div></section>
  </div>;
}
