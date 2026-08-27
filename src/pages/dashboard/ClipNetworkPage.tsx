/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types are updated by Lovable after the migration is applied. */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ReviewDesk, { type DeskFeedback, type DeskRevision, type DeskVariant } from "@/components/clip-network/ReviewDesk";
import {
  AlertTriangle, CheckCircle2, Clapperboard, Clock3, Copy, Download, ExternalLink,
  Instagram, Link2, Loader2, Play, Plus, Power, PowerOff, RefreshCw, RotateCcw, Sparkles, Trash2, Upload, Youtube, Zap,

} from "lucide-react";

const db = supabase as any;

const CLIP_NETWORK_API_URL = "https://pibkslzvwcnnarlcllmx.supabase.co/functions/v1/clip-network-api";
const CLIP_NETWORK_REVIEW_URL = "https://pibkslzvwcnnarlcllmx.supabase.co/functions/v1/clip-network-review-wake";
const CLIP_NETWORK_SIGN_MEDIA_URL = "https://pibkslzvwcnnarlcllmx.supabase.co/functions/v1/clip-network-sign-media";
const CLIP_WORKER_STATUS_URL = "https://pibkslzvwcnnarlcllmx.supabase.co/functions/v1/clip-worker-status";

async function clipApi(action:string, payload:Record<string,unknown> = {}) {
  const { data:{ session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error("Sessão expirada");

  const response = await fetch(CLIP_NETWORK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  const text = await response.text();
  let data:any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Resposta inválida do Clip Network (${response.status})`);
  }

  if (!response.ok || data?.error) {
    throw new Error(data?.error || `Clip Network API falhou (${response.status})`);
  }
  return data;
}

async function clipBridge(url:string, body:Record<string,unknown>) {
  const { data:{ session }, error } = await supabase.auth.getSession();
  if(error) throw error;

  const accessToken=session?.access_token;
  if(!accessToken) throw new Error("Sessão expirada");

  const response=await fetch(url,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      Authorization:`Bearer ${accessToken}`,
    },
    body:JSON.stringify(body),
  });

  const text=await response.text();
  let data:any={};

  try{
    data=text?JSON.parse(text):{};
  }catch{
    throw new Error(`Resposta inválida do Clip Network (${response.status})`);
  }

  if(!response.ok||data?.error){
    throw new Error(data?.error||`Clip Network falhou (${response.status})`);
  }

  return data;
}

type Network = { id:string; user_id:string; name:string; daily_limit:number; min_score:number; approval_mode:"review"|"auto"; timezone:string; posting_slots:string[]; active:boolean };
type ClipAccount = { id:string; label:string; niche:string; tone?:string; daily_limit:number; active:boolean; rules?:any };
type Social = { id:string; clip_account_id:string; platform:"instagram"|"tiktok"; username?:string; display_name?:string; status:string; capabilities?:any };
type Source = { id:string; label:string; provider_url?:string; rights_confirmed:boolean; last_checked_at?:string; last_error?:string; active:boolean };
type SourceVideo = { id:string; source_id:string; title:string; source_url?:string; thumbnail_url?:string; source_published_at?:string; media_status:string; transcript_status:string; rights_confirmed:boolean; pipeline_stage:string; stage_detail?:string; last_error?:string; clips_generated?:number; attempts?:number; duration_seconds?:number; updated_at?:string };
type Clip = { id:string; clip_account_id:string; source_video_id?:string; hook?:string; topic?:string; caption?:string; score:number; status:string; render_status:string; rendered_url?:string; rendered_storage_path?:string; last_error?:string; scheduled_at?:string; start_seconds?:number; end_seconds?:number; on_screen_title?:string };
type Publication = { id:string; clip_id:string; platform:string; status:string; scheduled_at?:string; published_at?:string; provider_media_id?:string; error_message?:string };
type ClipVariant = DeskVariant;
type ClipRevision = DeskRevision;
type ClipFeedback = DeskFeedback;
type WorkerStatus = {
  configured:boolean;
  machine_state:string;
  online:boolean;
  needs_worker:boolean;
  issue:boolean;
  pending_source_jobs:number;
  pending_render_jobs:number;
  total_jobs:number;
  machine_id?:string;
  app?:string;
  updated_at?:string|null;
  checked_at?:string;
  error?:string|null;
};

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
  error:"Erro", blocked:"Bloqueado",
};
const stageTone = (s:string, readyClips=0):"neutral"|"good"|"warn"|"bad"|"blue" =>
  s==="done" ? readyClips>0 ? "good" : "warn" : s==="error" ? "bad" : s==="blocked" ? "warn" : s==="discovered" ? "neutral" : "blue";
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
  const [variants,setVariants] = useState<ClipVariant[]>([]);
  const [revisions,setRevisions] = useState<ClipRevision[]>([]);
  const [feedback,setFeedback] = useState<ClipFeedback[]>([]);
  const [publications,setPublications] = useState<Publication[]>([]);
  const [sourceUrl,setSourceUrl] = useState("");
  const [sourceLabel,setSourceLabel] = useState("");
  const [rightsConfirmed,setRightsConfirmed] = useState(false);
  const [showSourceForm,setShowSourceForm] = useState(false);
  const [playing,setPlaying] = useState<Record<string,string>>({});
  const [reviewMessage,setReviewMessage] = useState<string|null>(null);
  const [workerStatus,setWorkerStatus] = useState<WorkerStatus|null>(null);

  const primaryAccount = accounts[0];
  const instagram = socials.find(s => s.clip_account_id === primaryAccount?.id && s.platform === "instagram" && s.status === "active");
  const publicationByClip = useMemo(() => new Map(publications.map(p => [p.clip_id,p])),[publications]);
  const publicationStatusByClip = useMemo(() => {
    const map:Record<string,string> = {};
    for (const p of publications) if (p.clip_id && p.status) map[p.clip_id] = p.status;
    return map;
  },[publications]);
  const accountById = useMemo(() => new Map(accounts.map(a => [a.id,a])),[accounts]);
  const sourceById = useMemo(() => new Map(sources.map(s => [s.id,s])),[sources]);
  const clipStatsByVideo = useMemo(() => {
    const map = new Map<string,{candidates:number;ready:number}>();
    for (const c of clips) if (c.source_video_id) {
      const stats=map.get(c.source_video_id)||{candidates:0,ready:0};
      stats.candidates+=1;
      if(c.render_status==="ready"&&(c.rendered_storage_path||c.rendered_url)) stats.ready+=1;
      map.set(c.source_video_id,stats);
    }
    return map;
  },[clips]);
  const today = new Date().toISOString().slice(0,10);
  const publishedToday = publications.filter(p => p.status === "published" && p.published_at?.startsWith(today)).length;
  
  const editorialClips = useMemo(() => clips.filter(c => c.source_video_id), [clips]);
  const legacyClips = useMemo(() => clips.filter(c => !c.source_video_id), [clips]);
  const readyClips = useMemo(
    () => legacyClips.filter(c => c.render_status === "ready" && !!(c.rendered_storage_path || c.rendered_url)),
    [legacyClips]
  );
  const ready = editorialClips.filter(clip => variants.some(variant => variant.clip_id===clip.id && variant.variant_key==="editorial_master" && variant.render_status==="ready")).length + readyClips.length;
  const running = videos.filter(v => ["downloading","transcribing","analyzing","rendering"].includes(v.pipeline_stage)).length
    + variants.filter(variant=>["pending","rendering"].includes(variant.render_status)).length;


  const loadWorkerStatus = async () => {
    try {
      const data = await clipBridge(
        CLIP_WORKER_STATUS_URL,
        {}
      );

      setWorkerStatus(data as WorkerStatus);
    } catch(e:any) {
      setWorkerStatus({
        configured:false,
        machine_state:"unknown",
        online:false,
        needs_worker:false,
        issue:false,
        pending_source_jobs:0,
        pending_render_jobs:0,
        total_jobs:0,
        error:e?.message || String(e),
      });
    }
  };
  const load = async (showLoading=false) => {
    if(showLoading) setLoading(true);
    setError(null);
    try {
      const data = await clipApi("bootstrap");
      const net = data?.network || null;
      setNetwork(net);
      setAccounts(data?.accounts || []);
      setSocials(data?.socials || []);
      setSources(data?.sources || []);
      const baseVideos:SourceVideo[]=(data?.videos || []).filter(
        (video:SourceVideo)=>video.pipeline_stage!=="blocked"
      );

      const nextClips:Clip[] = data?.clips || [];
      setClips(nextClips);
      setPublications(data?.publications || []);

      const reviewData=await clipBridge(
        CLIP_NETWORK_REVIEW_URL,
        {action:"bootstrap",payload:{}}
      );

      const pausedVideos:SourceVideo[]=reviewData?.paused_videos||[];
      const videosById=new Map<string,SourceVideo>();

      for(const video of [...baseVideos,...pausedVideos]){
        videosById.set(video.id,video);
      }

      setVideos([...videosById.values()]);
      setVariants(reviewData?.variants||[]);
      setRevisions(reviewData?.revisions||[]);
      setFeedback(reviewData?.feedback||[]);
    } catch(e:any) { setError(e.message || String(e)); }
    finally { if(showLoading) setLoading(false); }
  };

  useEffect(()=>{ load(true); },[]);
  useEffect(()=>{
    loadWorkerStatus();

    const workerStatusTimer=setInterval(()=>{
      loadWorkerStatus();
    },10000);

    return ()=>clearInterval(workerStatusTimer);
  },[]);

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
    if(sources.some(source=>source.provider_url?.replace(/\/+$/,"").toLowerCase()===normalizedUrl)){setError("Este canal já estÃ¡ cadastrado nas fontes monitoradas.");return;}
    setBusy("source"); setError(null);
    try {
      await clipApi("add_source", {
        network_id: network.id,
        label,
        provider_url: url,
        rights_confirmed: rightsConfirmed,
      });
      setSourceLabel(""); setSourceUrl(""); setRightsConfirmed(false); setShowSourceForm(false);
      await load();
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const discover = async (sourceId:string) => {
    setBusy(`discover:${sourceId}`); setError(null);
    try {
      const data=await clipApi("discover",{source_id:sourceId});
      const failure=data?.results?.find((result:any)=>result.source_id===sourceId&&result.error);
      if(failure){await load();throw new Error(failure.error);}
      if(!data?.results?.length) throw new Error("A fonte precisa estar ativa para executar a busca.");
      await load();
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const discoverAll = async () => {
    if(!network) return; setBusy("discover:all"); setError(null);
    try {
      const data=await clipApi("discover",{network_id:network.id});
      const failures=(data?.results||[]).filter((result:any)=>result.error);
      await load();
      if(failures.length) setError(`${failures.length} fonte(s) falharam na busca. Consulte o último erro em cada fonte.`);
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const toggleSource = async (source:Source) => {
    setBusy(`toggle:${source.id}`); setError(null);
    try {
      await clipApi("toggle_source",{source_id:source.id});
      await load();
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const removeSource = async (source:Source) => {
    if(!window.confirm(`Remover a fonte “${source.label}”? Os vídeos descobertos por ela serão removidos do pool; cortes já criados serão preservados.`)) return;
    setBusy(`remove:${source.id}`); setError(null);
    try {
      await clipApi("remove_source",{source_id:source.id});
      await load();
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const connectInstagram = async () => {
    if(!primaryAccount) return; setBusy("instagram"); setError(null);
    try {
      const data=await clipBridge(CLIP_INSTAGRAM_OAUTH_URL,{action:"get_auth_url",clip_account_id:primaryAccount.id});
      if(!data?.url) throw new Error(data?.error||"Não foi possível iniciar Instagram OAuth"); window.location.href=data.url;
    }catch(e:any){setError(e.message||String(e)); setBusy(null);}
  };

  const toggleAutopilot = async () => {
    if(!network) return; setBusy("auto"); setError(null);
    try {
      const data=await clipApi("toggle_autopilot",{network_id:network.id});
      setNetwork({...network,approval_mode:data.approval_mode});
    }
    catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const publishNow = async (clip:Clip) => {
    if(!instagram){setError("Conecte o Instagram antes de publicar.");return;} setBusy(`publish:${clip.id}`); setError(null);
    try{
      await clipBridge(CLIP_INSTAGRAM_PUBLISH_URL,{action:"publish",clip_id:clip.id,social_account_id:instagram.id});
      await load();
    }catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const approve = async (clip:Clip) => {
    setBusy(`approve:${clip.id}`); setError(null);
    try{await clipBridge(CLIP_NETWORK_REVIEW_URL,{action:"approve",payload:{clip_id:clip.id}});setReviewMessage("Momento aprovado. AI Editor preparando a edição final…");await load();}
    catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };
  const reject = async (clip:Clip) => {
    if(!window.confirm("Descartar este momento? Ele não será regenerado automaticamente."))return;
    setBusy(`reject:${clip.id}`); setError(null);
    try{const data=await clipBridge(CLIP_NETWORK_REVIEW_URL,{action:"discard",payload:{clip_id:clip.id}});setReviewMessage("Momento descartado. Ele não será regenerado automaticamente.");await load();}
    catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const submitFeedback = async (clip:Clip,text:string,variant?:ClipVariant) => {
    setBusy(`feedback:${clip.id}`);setError(null);setReviewMessage("Interpretando o pedido…");
    try{const data=await clipBridge(CLIP_NETWORK_REVIEW_URL,{action:"submit_feedback",payload:{clip_id:clip.id,clip_variant_id:variant?.id,feedback:text}});const understood=data?.interpreted_action?.summary||"ajuste solicitado";const revisionLabels=(data?.revisions||[]).map((item:any)=>`${item.label} v${item.revision_number}`).join(", ");setReviewMessage(`Entendido: ${understood}.${revisionLabels?` Gerando ${revisionLabels}…`:""}`);await load();}
    catch(e:any){setError(e.message||String(e));setReviewMessage(null);}finally{setBusy(null);}
  };

  const retryRevision = async (clip:Clip,revision:ClipRevision) => {
    setBusy(`retry-revision:${revision.id}`);setError(null);
    try{const data=await clipBridge(CLIP_NETWORK_REVIEW_URL,{action:"retry_revision",payload:{clip_id:clip.id,revision_id:revision.id}});setReviewMessage(`v${revision.revision_number} voltou para a fila de render.`);await load();}
    catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const signMedia = async (clip:Clip, download=false) => {
    const data=await clipApi("sign_media",{clip_id:clip.id,download});
    if(!data?.url) throw new Error("Mídia não disponível");
    return data.url as string;
  };

  const signVariantMedia = async (item:ClipVariant|ClipRevision,download=false,isRevision=false) => {
    const data=await clipBridge(
      CLIP_NETWORK_SIGN_MEDIA_URL,
      isRevision?{revision_id:item.id,download}:{variant_id:item.id,download}
    );
    if(!data?.url)throw new Error("Mídia não disponível");
    return data.url as string;
  };

  const watchVariant = async (item:ClipVariant|ClipRevision,isRevision=false) => {
    setBusy(`watch:${item.id}`);setError(null);try{const url=await signVariantMedia(item,false,isRevision);setPlaying(current=>({...current,[item.id]:url}));}catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  const downloadVariant = async (item:ClipVariant|ClipRevision,isRevision=false) => {
    setBusy(`download:${item.id}`);setError(null);try{const url=await signVariantMedia(item,true,isRevision);window.open(url,"_blank","noopener");}catch(e:any){setError(e.message||String(e));}finally{setBusy(null);}
  };

  useEffect(()=>{
    const missing = readyClips.filter(clip => !playing[clip.id]).slice(0,12);
    if(!missing.length) return;

    let cancelled = false;

    Promise.all(
      missing.map(async clip => {
        try {
          const url = await signMedia(clip);
          return [clip.id, url] as const;
        } catch {
          return null;
        }
      })
    ).then(entries => {
      if(cancelled) return;
      const valid = entries.filter(Boolean) as [string,string][];
      if(valid.length) setPlaying(current => ({...current, ...Object.fromEntries(valid)}));
    });

    return ()=>{ cancelled = true; };
  },[clips,playing,readyClips]);

  useEffect(()=>{
    const missing=variants.filter(variant=>variant.render_status==="ready"&&!playing[variant.id]).slice(0,12);
    if(!missing.length)return;
    let cancelled=false;
    Promise.all(missing.map(async variant=>{try{return [variant.id,await signVariantMedia(variant)] as const;}catch{return null;}})).then(entries=>{if(cancelled)return;const valid=entries.filter(Boolean) as [string,string][];if(valid.length)setPlaying(current=>({...current,...Object.fromEntries(valid)}));});
    return()=>{cancelled=true;};
  },[variants,playing]);

  const watch = async (clip:Clip) => {
    setBusy(`watch:${clip.id}`); setError(null);
    try { const url=await signMedia(clip); setPlaying(p=>({...p,[clip.id]:url})); }
    catch(e:any){ setError(e.message||String(e)); } finally { setBusy(null); }
  };

  const downloadClip = async (clip:Clip) => {
    setBusy(`download:${clip.id}`); setError(null);
    try { const url=await signMedia(clip,true); window.open(url,"_blank","noopener"); }
    catch(e:any){ setError(e.message||String(e)); } finally { setBusy(null); }
  };

  const pauseVideo = async (video:SourceVideo) => {
    setBusy(`pause-video:${video.id}`);
    setError(null);

    try {
      await clipBridge(CLIP_NETWORK_REVIEW_URL,{
        action:"pause_video",
        payload:{video_id:video.id},
      });
      await load();
    } catch(e:any) {
      setError(e.message||String(e));
    } finally {
      setBusy(null);
    }
  };

  const resumeVideo = async (video:SourceVideo) => {
    setBusy(`resume-video:${video.id}`);
    setError(null);

    try {
      await clipBridge(CLIP_NETWORK_REVIEW_URL,{
        action:"resume_video",
        payload:{video_id:video.id},
      });
      await load();
    } catch(e:any) {
      setError(e.message||String(e));
    } finally {
      setBusy(null);
    }
  };

  const deleteVideo = async (video:SourceVideo) => {
    const confirmed=window.confirm(
      `Excluir “${video.title}” da Máquina de cortes?\n\nIsso removerá também todos os cortes e revisões associados a esse vídeo. Esta ação não pode ser desfeita.`
    );

    if(!confirmed) return;

    setBusy(`delete-video:${video.id}`);
    setError(null);

    try {
      await clipBridge(CLIP_NETWORK_REVIEW_URL,{
        action:"delete_video",
        payload:{video_id:video.id},
      });

      setPlaying(current=>{
        const next={...current};
        for(const clip of clips.filter(item=>item.source_video_id===video.id)){
          delete next[clip.id];
        }
        return next;
      });

      await load();
    } catch(e:any) {
      setError(e.message||String(e));
    } finally {
      setBusy(null);
    }
  };

  const retryVideo = async (video:SourceVideo) => {
    setBusy(`retry:${video.id}`); setError(null);
    try { await clipApi("retry_video",{video_id:video.id}); await load(); }
    catch(e:any){ setError(e.message||String(e)); } finally { setBusy(null); }
  };

  useEffect(()=>{
    if(!running) return;
    const t=setInterval(()=>{ load(); },15000);
    return ()=>clearInterval(t);
  },[running]);



  const workerStateLabel =
    workerStatus?.machine_state === "started" ? "Ligado" :
    workerStatus?.machine_state === "starting" ? "Ligando" :
    workerStatus?.machine_state === "replacing" ? "Atualizando" :
    workerStatus?.machine_state === "stopping" ? "Desligando" :
    workerStatus?.machine_state === "stopped" ? "Desligado" :
    "Status indisponível";

  const workerTone:
    "neutral"|"good"|"warn"|"bad"|"blue" =
      workerStatus?.issue ? "bad" :
      workerStatus?.machine_state === "started" ? "good" :
      ["starting","replacing"].includes(workerStatus?.machine_state || "") ? "blue" :
      workerStatus?.machine_state === "stopping" ? "warn" :
      workerStatus?.error ? "bad" :
      "neutral";

  const workerDetail =
    workerStatus?.issue
      ? `ERRO: ${workerStatus.total_jobs} trabalho(s) na fila e o worker está desligado.`
      : workerStatus?.error
        ? workerStatus.error
        : workerStatus?.machine_state === "started" && workerStatus.total_jobs > 0
          ? `${workerStatus.total_jobs} trabalho(s) aguardando ou processando`
          : workerStatus?.machine_state === "started"
            ? "Ligado, sem trabalho no momento"
            : workerStatus?.machine_state === "stopped" && workerStatus.total_jobs === 0
              ? "Sem trabalho — liga automaticamente quando necessário"
              : workerStatus?.machine_state === "starting"
                ? "A máquina está iniciando"
                : workerStatus?.machine_state === "stopping"
                  ? "Fila vazia — máquina desligando"
                  : "Consultando estado da máquina";
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
        <button onClick={()=>load()} className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><RefreshCw className="mr-2 h-3.5 w-3.5"/>Atualizar</button>
        <button onClick={toggleAutopilot} disabled={busy==='auto'} className={`inline-flex items-center rounded-xl px-4 py-2 text-xs font-medium ${network.approval_mode==='auto'?'bg-emerald-500/15 text-emerald-300':'bg-violet-500 text-white'}`}><Zap className="mr-2 h-3.5 w-3.5"/>{network.approval_mode==='auto'?'Pausar autopilot':'Ativar autopilot'}</button>
      </div>
    </div>

    {error&&<div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}
    {/* Status real da Fly Machine */}
    <div
      className={`rounded-2xl border p-4 ${
        workerStatus?.issue
          ? "border-red-500/30 bg-red-500/[.08]"
          : workerStatus?.machine_state === "started"
            ? "border-emerald-500/20 bg-emerald-500/[.05]"
            : "border-white/10 bg-white/[.035]"
      }`}
    >
      <div className="flex items-center justify-between gap-4">

        <div className="flex min-w-0 items-center gap-3">

          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              workerStatus?.machine_state === "started"
                ? "bg-emerald-500/10 text-emerald-300"
                : workerStatus?.issue
                  ? "bg-red-500/10 text-red-300"
                  : "bg-white/5 text-white/50"
            }`}
          >
            {workerStatus?.machine_state === "started"
              ? <Power className="h-4 w-4"/>
              : <PowerOff className="h-4 w-4"/>
            }
          </div>

          <div className="min-w-0">
            <div className="text-xs font-medium text-white/45">
              Worker Fly
            </div>

            <div
              className={`mt-0.5 text-sm font-medium ${
                workerStatus?.issue
                  ? "text-red-200"
                  : "text-white/80"
              }`}
            >
              {workerDetail}
            </div>

            {workerStatus && (
              <div className="mt-1 text-[10px] text-white/30">
                Fly: {workerStatus.machine_state}
                {" · "}
                fontes: {workerStatus.pending_source_jobs}
                {" · "}
                renders: {workerStatus.pending_render_jobs}
              </div>
            )}
          </div>
        </div>

        <Pill tone={workerTone}>
          {workerStateLabel}
        </Pill>
      </div>

      {workerStatus?.issue && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0"/>
          O worker deveria estar ligado. O auto-wake pode ter falhado.
        </div>
      )}
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[['Processando agora',running,'vídeos na máquina'],['Clips prontos',ready,'renderizados'],['Publicados hoje',publishedToday,'de '+network.daily_limit],['Fontes',sources.length,'monitoradas']].map(([a,b,c])=><div key={String(a)} className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="text-xs text-white/40">{a}</div><div className="mt-2 text-2xl font-semibold text-white">{b}</div><div className="mt-1 text-[11px] text-white/35">{c}</div></div>)}
    </div>

    <ReviewDesk
      clips={editorialClips}
      variants={variants}
      revisions={revisions}
      feedback={feedback}
      videos={videos}
      sources={sources}
      accounts={accounts}
      mediaUrls={playing}
      busy={busy}
      message={reviewMessage}
      onApprove={clip=>approve(clip as Clip)}
      onDiscard={clip=>reject(clip as Clip)}
      onFeedback={(clip,text,variant)=>submitFeedback(clip as Clip,text,variant)}
      onWatchVariant={variant=>watchVariant(variant)}
      onWatchRevision={revision=>watchVariant(revision,true)}
      onDownload={(item,isRevision)=>downloadVariant(item,isRevision)}
      onRetry={(clip,revision)=>retryRevision(clip as Clip,revision)}
      canPublishInstagram={!!instagram}
      onPublish={clip=>publishNow(clip as Clip)}
      publicationStatusByClip={publicationStatusByClip}
    />

    {readyClips.length>0&&<section className="rounded-3xl border border-emerald-500/15 bg-emerald-500/[.035] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Clips prontos</h2>
          <p className="mt-1 text-xs text-white/40">MP4s finalizados e prontos para assistir ou baixar.</p>
        </div>
        <Pill tone="good">{readyClips.length} prontos</Pill>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {readyClips.map(clip=><div key={clip.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          {playing[clip.id]
            ? <video
                src={playing[clip.id]}
                controls
                playsInline
                preload="metadata"
                className="aspect-[9/16] max-h-[520px] w-full bg-black object-contain"
              />
            : <div className="flex aspect-[9/16] max-h-[520px] items-center justify-center bg-black/50 text-white/40">
                <Loader2 className="h-6 w-6 animate-spin"/>
              </div>
          }

          <div className="p-3">
            <div className="line-clamp-2 text-xs font-medium text-white">
              {clip.on_screen_title||clip.hook||clip.topic||"Clip pronto"}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <Pill tone="good">{Math.round(clip.score)} score</Pill>
              {clip.start_seconds!=null&&clip.end_seconds!=null&&
                <Pill>{Math.round(clip.end_seconds-clip.start_seconds)}s</Pill>}
            </div>

            <div className="mt-3 flex gap-2">
              <button onClick={()=>watch(clip)} className="inline-flex flex-1 items-center justify-center rounded-lg bg-white px-2.5 py-2 text-[11px] font-semibold text-black">
                <Play className="mr-1.5 h-3.5 w-3.5"/>Assistir
              </button>
              <button onClick={()=>downloadClip(clip)} className="inline-flex items-center justify-center rounded-lg border border-white/10 px-2.5 py-2 text-[11px] text-white/65">
                <Download className="h-3.5 w-3.5"/>
              </button>
            </div>
          </div>
        </div>)}
      </div>
    </section>}

    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Uploads manuais</h2><p className="mt-1 text-xs text-white/40">Compatibilidade com MP4s enviados diretamente para publicação.</p></div><Pill>{legacyClips.length} clips</Pill></div>
        <div className="mt-5 space-y-3">
          {legacyClips.length===0&&<div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/35">Nenhum upload manual. Os cortes editoriais aparecem na mesa de revisão acima.</div>}
          {legacyClips.slice(0,30).map(clip=>{
            const pub=publicationByClip.get(clip.id);
            const editorial=accountById.get(clip.clip_account_id)?.label;
            const hasVideo=!!(clip.rendered_storage_path||clip.rendered_url);
            const dur=clip.start_seconds!=null&&clip.end_seconds!=null?Math.round(clip.end_seconds-clip.start_seconds):null;
            const url=playing[clip.id];
            return <div key={clip.id} className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Pill tone={clip.score>=85?'good':clip.score>=75?'blue':'neutral'}>{Math.round(clip.score)} score</Pill>{editorial&&<Pill tone="blue">{editorial}</Pill>}<Pill>{statusLabel[pub?.status||clip.status]||pub?.status||clip.status}</Pill>{hasVideo?<Pill tone="good">vídeo pronto</Pill>:<Pill>{statusLabel[clip.render_status]||clip.render_status}</Pill>}{dur!=null&&<Pill>{dur}s</Pill>}</div>
              <div className="mt-3 text-sm font-medium text-white">{clip.on_screen_title||clip.hook||clip.topic||'Clip sem título'}</div>
              {clip.hook&&clip.hook!==clip.on_screen_title&&<p className="mt-1 text-xs text-white/55">Hook: {clip.hook}</p>}
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">{clip.caption||'Sem caption'}</p>
              <div className="mt-2 flex gap-3 text-[11px] text-white/30">{clip.start_seconds!=null&&<span>{mmss(clip.start_seconds)} → {mmss(clip.end_seconds)}</span>}{clip.scheduled_at&&<span><Clock3 className="mr-1 inline h-3 w-3"/>{fmt(clip.scheduled_at)}</span>}</div>
              {url&&<video src={url} controls playsInline className="mt-3 max-h-[420px] w-full max-w-[240px] rounded-xl border border-white/10 bg-black"/>}
              {(clip.last_error||pub?.error_message)&&<div className="mt-2 text-xs text-red-300">{clip.last_error||pub?.error_message}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-stretch md:justify-center">
              {clip.status==='candidate'&&<><button onClick={()=>approve(clip)} disabled={busy===`approve:${clip.id}`} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[11px] font-medium text-emerald-300">Aprovar</button><button onClick={()=>reject(clip)} className="rounded-lg bg-white/5 px-3 py-2 text-[11px] text-white/55">Rejeitar</button></>}
              {hasVideo&&<>
                <button onClick={()=>watch(clip)} disabled={busy===`watch:${clip.id}`} className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-black disabled:opacity-40">{busy===`watch:${clip.id}`?<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>:<Play className="mr-1.5 h-3.5 w-3.5"/>}Assistir</button>
                <button onClick={()=>downloadClip(clip)} disabled={busy===`download:${clip.id}`} className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white/60"><Download className="mr-1.5 h-3.5 w-3.5"/>Baixar MP4</button>
                <button onClick={()=>navigator.clipboard.writeText(clip.caption||'')} className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white/60"><Copy className="mr-1.5 h-3.5 w-3.5"/>Caption</button>
                {instagram&&<button onClick={()=>publishNow(clip)} disabled={!!busy||pub?.status==='published'} className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white/60 disabled:opacity-40"><Instagram className="mr-1.5 h-3.5 w-3.5"/>{pub?.status==='published'?'Publicado':'Publicar IG'}</button>}
              </>}
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
      </div>
    </div>

    <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5">
      <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-white">Máquina de cortes</h2><p className="mt-1 text-xs text-white/40">Descoberto → Baixando → Transcrevendo → Analisando → Renderizando → Concluído. Tudo sem clique quando a fonte está autorizada.</p></div><Pill>{videos.length}</Pill></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{videos.slice(0,12).map(v=>{
        const stage=v.pipeline_stage||"discovered";
        const idx=STAGES.indexOf(stage as typeof STAGES[number]);
        const clipStats=clipStatsByVideo.get(v.id)||{candidates:0,ready:0};
        const candidates=clipStats.candidates;
        const readyCuts=clipStats.ready;
        const doneWithoutClips=stage==="done"&&readyCuts===0;
        const canRetry=stage!=="blocked"&&(stage==="error"||(v.attempts||0)>0);
        const manualPaused=stage==="blocked"&&v.stage_detail==="Pausado manualmente";
        const activelyProcessing=["downloading","transcribing","analyzing","rendering"].includes(stage);
        const canPause=["discovered","error"].includes(stage);
        const canDelete=!activelyProcessing;
        return <div key={v.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          {v.thumbnail_url?<img src={v.thumbnail_url} alt={v.title} className="aspect-video w-full object-cover opacity-80"/>:<div className="aspect-video bg-white/5"/>}
          <div className="p-3">
            <div className="text-[10px] text-white/30">{sourceById.get(v.source_id)?.label||"fonte"}</div>
            <a href={v.source_url} target="_blank" rel="noreferrer" className="mt-1 line-clamp-2 block text-xs font-medium leading-5 text-white hover:text-sky-300">{v.title}</a>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill tone={manualPaused?"warn":stageTone(stage,readyCuts)}>
                {manualPaused?"Pausado":doneWithoutClips?"Concluído sem clips prontos":stageLabel[stage]||stage}
              </Pill>
              {readyCuts>0&&<Pill tone="good">{readyCuts} {readyCuts===1?"corte pronto":"cortes prontos"}</Pill>}
              {readyCuts===0&&candidates>0&&<Pill>{candidates} {candidates===1?"candidato":"candidatos"}</Pill>}
              {v.duration_seconds!=null&&<Pill>{mmss(v.duration_seconds)}</Pill>}
              {!v.rights_confirmed&&<Pill tone="warn">sem autorização</Pill>}
            </div>
            <div className="mt-4 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {stage!=="done"&&stage!=="error"&&
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-40"/>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400"/>
                      </span>
                    }
                    {stage==="done"&&<span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400"/>}
                    {stage==="error"&&<span className="h-2 w-2 shrink-0 rounded-full bg-red-400"/>}
                    <span className="truncate text-[11px] font-medium text-white/80">
                      {doneWithoutClips
                        ?"Processamento concluído"
                        :stage==="done"
                          ?"Processamento concluído"
                          :stage==="error"
                            ?"Processamento interrompido"
                            :stageLabel[stage]||stage}
                    </span>
                  </div>

                  <div className="mt-1 truncate text-[10px] text-white/35">
                    {v.stage_detail||(
                      stage==="discovered" ? "Aguardando processamento"
                      : stage==="downloading" ? "Preparando mídia original"
                      : stage==="transcribing" ? "Convertendo fala em transcrição"
                      : stage==="analyzing" ? "Selecionando oportunidades editoriais"
                      : stage==="rendering" ? "Gerando versões finais"
                      : stage==="done" ? "Tudo finalizado"
                      : fmt(v.updated_at)
                    )}
                  </div>
                </div>

                {stage!=="error"&&
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-medium text-white/55">
                      {stage==="done" ? "6/6" : `${Math.max(1,idx+1)}/6`}
                    </div>
                    <div className="mt-0.5 text-[9px] text-white/25">etapas</div>
                  </div>
                }
              </div>

              <div className="mt-3 grid grid-cols-6 gap-1">
                {STAGES.map((step,stepIndex)=>{
                  const active=step===stage;
                  const completed=stage==="done"||idx>stepIndex;
                  const failed=stage==="error"&&stepIndex===Math.max(0,idx);

                  return <div key={step} className="relative">
                    <div className={`h-1.5 overflow-hidden rounded-full transition-all duration-500 ${
                      failed
                        ?"bg-red-400/70"
                        :completed
                          ?"bg-emerald-400/75"
                          :active
                            ?"bg-sky-400/25"
                            :"bg-white/[.07]"
                    }`}>
                      {active&&stage!=="done"&&(stage as string)!=="error"&&
                        <div className="h-full w-2/3 animate-pulse rounded-full bg-sky-300/90"/>
                      }
                    </div>
                  </div>;
                })}
              </div>

              <div className="mt-2.5 flex justify-between text-[8px] text-white/20">
                <span>Descoberto</span>
                <span>Download</span>
                <span>Transcrição</span>
                <span>Análise</span>
                <span>Render</span>
                <span>Pronto</span>
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-white/[.05] pt-2 text-[9px] text-white/25">
                <span>
                  {stage==="done"
                    ?"Finalizado"
                    :stage==="error"
                      ?"Requer atenção"
                      :"Atualização automática"}
                </span>
                {(v.attempts||0)>0&&<span>tentativa {v.attempts}</span>}
              </div>
            </div>
            {v.last_error&&<div className="mt-2 rounded-lg border border-red-500/15 bg-red-500/10 px-2 py-1.5 text-[10px] leading-4 text-red-300">{v.last_error}</div>}
            {canRetry&&<button onClick={()=>retryVideo(v)} disabled={busy===`retry:${v.id}`} className="mt-2.5 inline-flex items-center rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-white/60 hover:bg-white/5 disabled:opacity-40">{busy===`retry:${v.id}`?<Loader2 className="mr-1.5 h-3 w-3 animate-spin"/>:<RotateCcw className="mr-1.5 h-3 w-3"/>}Reprocessar</button>}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[.06] pt-3">
              {canPause&&
                <button
                  onClick={()=>pauseVideo(v)}
                  disabled={!!busy}
                  className="inline-flex items-center rounded-lg border border-amber-500/15 bg-amber-500/[.06] px-2.5 py-1.5 text-[10px] text-amber-200/75 hover:bg-amber-500/10 disabled:opacity-35"
                >
                  {busy===`pause-video:${v.id}`
                    ?<Loader2 className="mr-1.5 h-3 w-3 animate-spin"/>
                    :<PowerOff className="mr-1.5 h-3 w-3"/>
                  }
                  Pausar
                </button>
              }

              {manualPaused&&
                <button
                  onClick={()=>resumeVideo(v)}
                  disabled={!!busy}
                  className="inline-flex items-center rounded-lg border border-emerald-500/15 bg-emerald-500/[.06] px-2.5 py-1.5 text-[10px] text-emerald-200/75 hover:bg-emerald-500/10 disabled:opacity-35"
                >
                  {busy===`resume-video:${v.id}`
                    ?<Loader2 className="mr-1.5 h-3 w-3 animate-spin"/>
                    :<Power className="mr-1.5 h-3 w-3"/>
                  }
                  Retomar
                </button>
              }

              {activelyProcessing&&
                <span className="text-[9px] text-white/25">
                  Controles disponíveis quando esta etapa terminar
                </span>
              }

              {canDelete&&
                <button
                  onClick={()=>deleteVideo(v)}
                  disabled={!!busy}
                  className="ml-auto inline-flex items-center rounded-lg border border-red-500/15 px-2.5 py-1.5 text-[10px] text-red-300/65 hover:bg-red-500/[.08] disabled:opacity-35"
                >
                  {busy===`delete-video:${v.id}`
                    ?<Loader2 className="mr-1.5 h-3 w-3 animate-spin"/>
                    :<Trash2 className="mr-1.5 h-3 w-3"/>
                  }
                  Excluir
                </button>
              }
            </div>
          </div>
        </div>;
      })}
      {videos.length===0&&<div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-white/35 sm:col-span-2 xl:col-span-3">Nenhum vídeo descoberto ainda. O discovery roda a cada 15 minutos.</div>}
      </div>
    </section>

  </div>;
}
