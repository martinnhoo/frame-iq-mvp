/* eslint-disable @typescript-eslint/no-explicit-any -- revision settings are persisted JSON with preset-specific keys. */
import { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  Download,
  History,
  Instagram,
  Layers3,
  ListChecks,
  Loader2,
  MessageSquareText,
  Play,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";

export type DeskClip = { id:string; clip_account_id:string; source_video_id?:string; hook?:string; topic?:string; caption?:string; score:number; status:string; render_status:string; start_seconds?:number; end_seconds?:number; on_screen_title?:string };
export type DeskVariant = { id:string; clip_id:string; variant_key:string; current_revision:number; current_revision_id?:string; render_status:string; rendered_storage_path?:string; last_error?:string; render_attempts:number; parameters?:Record<string,unknown> };
export type DeskRevision = { id:string; clip_id:string; clip_variant_id:string; revision_number:number; feedback_text?:string; interpreted_action?:any; previous_parameters?:any; parameters?:any; render_status:string; rendered_storage_path?:string; last_error?:string; created_at:string };
export type DeskFeedback = { id:string; clip_id:string; feedback_text:string; interpreted_action?:any; status:string; created_at:string };
type DeskVideo = {
  id:string;
  title:string;
  thumbnail_url?:string;
  source_url?:string;
  source_id:string;
  pipeline_stage?:string;
  stage_detail?:string;
  updated_at?:string;
};
type DeskSource = { id:string; label:string };
type DeskAccount = { id:string; label:string };
type DeskTab = "review"|"approved"|"rendering"|"ready"|"discarded";

const LABELS:Record<string,string> = {
  editorial_master:"Edição final",
};
const DESCRIPTIONS:Record<string,string> = {
  editorial_master:"Versão final criada pelo AI Editor",
};
const ORDER = ["editorial_master"];

const PIPELINE_LABELS:Record<string,string> = {
  downloading:"Baixando vídeo",
  transcribing:"Transcrevendo áudio",
  analyzing:"Analisando com IA",
  rendering:"Renderizando",
};
const mmss = (seconds?:number) => seconds == null ? "—" : `${Math.floor(seconds/60)}:${String(Math.round(seconds%60)).padStart(2,"0")}`;
const fmt = (value?:string) => value ? new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value)) : "—";



const V4_PHASE_LABELS:Record<string,string> = {
  acquire:"Obtendo video",
  vision:"Analisando pessoas e camera",
  captions:"Montando legendas",
  render:"Renderizando MP4",
  qa:"Validando arquivo",
  upload:"Enviando para storage",
  done:"Concluido",
  error:"Erro",
};

const fmtDurationMs=(value?:number|null)=>{
  if(value==null||!Number.isFinite(Number(value)))return "—";
  const total=Math.max(0,Math.round(Number(value)/1000));
  const minutes=Math.floor(total/60);
  const seconds=total%60;
  return minutes>0?`${minutes}m ${String(seconds).padStart(2,"0")}s`:`${seconds}s`;
};

function RenderTelemetry({revision,status}:{revision?:DeskRevision;status:string}) {
  const progress=revision?.parameters?.v4_progress;
  if(!progress){
    if(status==="pending")return <div className="mt-3 text-[10px] text-white/35">Na fila do render.</div>;
    return null;
  }

  const pct=Math.max(0,Math.min(100,Number(progress.overall_pct||0)));
  const elapsed=Number(progress.total_duration_ms||progress.elapsed_ms||revision?.parameters?.render_duration_ms||0);
  const phase=String(progress.phase||"");
  const current=progress.current;
  const total=progress.total;
  const eta=progress.eta_seconds==null?null:Number(progress.eta_seconds);
  const detail=String(progress.detail||"").trim();

  return <div className="mt-3 rounded-lg border border-white/8 bg-white/[.025] p-3">
    <div className="flex items-center justify-between gap-3">
      <div className="text-[10px] font-medium text-white/65">
        {V4_PHASE_LABELS[phase]||phase||"AI Editor v4"}
      </div>
      <div className="text-[10px] tabular-nums text-white/55">
        {status==="ready"?"100%":`${Math.round(pct)}%`}
      </div>
    </div>

    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
      <div
        className="h-full rounded-full bg-sky-400 transition-[width] duration-500"
        style={{width:`${status==="ready"?100:pct}%`}}
      />
    </div>

    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-white/35">
      <span>Tempo: {fmtDurationMs(elapsed)}</span>
      {current!=null&&total!=null&&<span>{current}/{total}</span>}
      {eta!=null&&eta>0&&status==="rendering"&&<span>ETA ~{fmtDurationMs(eta*1000)}</span>}
      {revision?.parameters?.editor_version===4&&<span>AI Editor v4</span>}
      {revision?.parameters?.renderer&&<span>{String(revision.parameters.renderer)}</span>}
    </div>

    {detail&&<div className="mt-1.5 text-[9px] text-white/30">{detail}</div>}

    {status==="ready"&&
      <div className="mt-2 text-[10px] text-emerald-300/70">
        Concluido em {fmtDurationMs(Number(revision?.parameters?.render_duration_ms||elapsed))}
      </div>
    }
  </div>;
}

function Status({status}:{status:string}) {
  const styles = status === "ready" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
    : status === "error" ? "border-red-500/20 bg-red-500/10 text-red-300"
    : status === "rendering" ? "border-sky-500/20 bg-sky-500/10 text-sky-300"
    : "border-white/10 bg-white/5 text-white/55";
  const label = { ready:"Pronto", error:"Erro", rendering:"Renderizando", pending:"Na fila" }[status] || status;
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${styles}`}>
    {status === "rendering" && <Loader2 className="mr-1.5 h-3 w-3 animate-spin"/>}
    {status === "ready" && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400"/>}
    {label}
  </span>;
}

function FeedbackBox({busy,targetLabel,onSubmit,onCancel}:{busy:boolean;targetLabel:string;onSubmit:(text:string)=>void;onCancel:()=>void}) {
  const [text,setText]=useState("");
  return <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[.06] p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-lg bg-violet-500/15 p-2 text-violet-200"><MessageSquareText className="h-4 w-4"/></div>
      <div><div className="text-sm font-medium text-white">O que você quer ajustar?</div><div className="mt-1 text-[11px] text-white/40">Aplicar em: {targetLabel}</div></div>
    </div>
    <textarea autoFocus value={text} onChange={event=>setText(event.target.value)} rows={3} placeholder="Ex.: corte 3 segundos do começo, diminua a legenda ou ajuste o enquadramento" className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-xs leading-5 text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/10"/>
    <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className="rounded-lg border border-white/10 px-3.5 py-2.5 text-[11px] text-white/55 hover:bg-white/5">Cancelar</button><button type="button" onClick={()=>onSubmit(text)} disabled={busy||!text.trim()} className="inline-flex items-center justify-center rounded-lg bg-violet-500 px-4 py-2.5 text-[11px] font-semibold text-white shadow-[0_8px_30px_rgba(124,58,237,.2)] transition hover:bg-violet-400 disabled:opacity-40">{busy&&<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>}Pedir ajuste</button></div>
  </div>;
}

export default function ReviewDesk({clips,variants,revisions,feedback,videos,sources,accounts,mediaUrls,busy,message,onApprove,onDiscard,onFeedback,onWatchVariant,onWatchRevision,onDownload,onRetry,canPublishInstagram,onPublish,publicationStatusByClip}:{
  clips:DeskClip[];variants:DeskVariant[];revisions:DeskRevision[];feedback:DeskFeedback[];videos:DeskVideo[];sources:DeskSource[];accounts:DeskAccount[];mediaUrls:Record<string,string>;busy:string|null;message?:string|null;
  onApprove:(clip:DeskClip)=>void;onDiscard:(clip:DeskClip)=>void;onFeedback:(clip:DeskClip,text:string,variant?:DeskVariant)=>void;onWatchVariant:(variant:DeskVariant)=>void;onWatchRevision:(revision:DeskRevision)=>void;onDownload:(item:DeskVariant|DeskRevision,isRevision?:boolean)=>void;onRetry:(clip:DeskClip,revision:DeskRevision)=>void;
  canPublishInstagram?:boolean;onPublish?:(clip:DeskClip)=>void;publicationStatusByClip?:Record<string,string>;
}) {
  const [tab,setTab]=useState<DeskTab>("review");
  const [reviewIndex,setReviewIndex]=useState(0);
  const [feedbackTarget,setFeedbackTarget]=useState<{clip:DeskClip;variant?:DeskVariant}|null>(null);
  const [selectedVariantByClip,setSelectedVariantByClip]=useState<Record<string,string>>({});
  const videoById=useMemo(()=>new Map(videos.map(video=>[video.id,video])),[videos]);
  const sourceById=useMemo(()=>new Map(sources.map(source=>[source.id,source])),[sources]);
  const accountById=useMemo(()=>new Map(accounts.map(account=>[account.id,account])),[accounts]);
  const variantsByClip=useMemo(()=>{
    const map=new Map<string,DeskVariant[]>();
    for(const variant of variants){const list=map.get(variant.clip_id)||[];list.push(variant);map.set(variant.clip_id,list);}
    for(const list of map.values())list.sort((a,b)=>ORDER.indexOf(a.variant_key)-ORDER.indexOf(b.variant_key));
    return map;
  },[variants]);
  const review=clips.filter(clip=>clip.status==="candidate");
  const discarded=clips.filter(clip=>clip.status==="rejected");
  const masterOf=(clipId:string)=>(variantsByClip.get(clipId)||[]).find(variant=>variant.variant_key==="editorial_master");
  const approved=clips.filter(clip=>clip.status==="approved"&&!masterOf(clip.id));
  const ready=clips.filter(clip=>clip.status==="approved"&&(variantsByClip.get(clip.id)||[]).some(variant=>variant.variant_key==="editorial_master"&&variant.render_status==="ready"));
  const rendering=clips.filter(clip=>clip.status==="approved"&&!!masterOf(clip.id)&&masterOf(clip.id)?.render_status!=="ready");
  const groups:Record<DeskTab,DeskClip[]>={review,approved,rendering,ready,discarded};
  const counters = [
    {key:"review" as const,label:"Revisão",count:review.length,icon:<ListChecks className="h-4 w-4"/>},
    {key:"approved" as const,label:"Aprovados",count:approved.length,icon:<CircleCheckBig className="h-4 w-4"/>},
    {key:"rendering" as const,label:"Renderizando",count:rendering.length,icon:<Clock3 className="h-4 w-4"/>},
    {key:"ready" as const,label:"Prontos",count:ready.length,icon:<Layers3 className="h-4 w-4"/>},
    {key:"discarded" as const,label:"Descartados",count:discarded.length,icon:<XCircle className="h-4 w-4"/>},
  ];
  const activeReview=review[Math.min(reviewIndex,Math.max(0,review.length-1))];

  const activeWorkerVideo=videos.find(video=>
    ["downloading","transcribing","analyzing","rendering"].includes(video.pipeline_stage||"")
  );

  const pendingVariants=variants.filter(variant=>variant.variant_key==="editorial_master"&&variant.render_status==="pending").length;
  const renderingVariants=variants.filter(variant=>variant.variant_key==="editorial_master"&&variant.render_status==="rendering").length;

  const submitFeedback=(text:string)=>{if(!feedbackTarget)return;onFeedback(feedbackTarget.clip,text,feedbackTarget.variant);setFeedbackTarget(null);};
  const clipTitle=(clip:DeskClip)=>clip.on_screen_title||clip.hook||clip.topic||"Momento sem título";
  const clipMeta=(clip:DeskClip)=>{
    const video=videoById.get(clip.source_video_id||"");
    return {
      video,
      source:sourceById.get(video?.source_id||"")?.label||"Fonte",
      account:accountById.get(clip.clip_account_id)?.label,
      duration:Math.max(0,Math.round(Number(clip.end_seconds||0)-Number(clip.start_seconds||0))),
    };
  };
  const clipSummary=(clip:DeskClip,thumbnail=false)=>{
    const meta=clipMeta(clip);
    return <div className="flex min-w-0 gap-3">
      {thumbnail&&<div className="hidden h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 sm:block">{meta.video?.thumbnail_url?<img src={meta.video.thumbnail_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center"><Play className="h-4 w-4 text-white/20"/></div>}</div>}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-200">{Math.round(clip.score)} score</span>{meta.account&&<span className="rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-1 text-[10px] text-white/55">{meta.account}</span>}<span className="text-[11px] text-white/35">{mmss(clip.start_seconds)} → {mmss(clip.end_seconds)} · {meta.duration}s</span></div>
        <h3 className="mt-2.5 text-base font-semibold leading-6 text-white sm:text-lg">{clipTitle(clip)}</h3>
        {clip.hook&&clip.hook!==clip.on_screen_title&&<p className="mt-1 line-clamp-2 text-xs leading-5 text-white/50">{clip.hook}</p>}
        <p className="mt-2 truncate text-[11px] text-white/35">{meta.source} · {meta.video?.title||"vídeo"}</p>
      </div>
    </div>;
  };

  return <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b0d11]/80 shadow-[0_24px_80px_rgba(0,0,0,.18)]">
    <div className="border-b border-white/[.08] p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-base font-semibold text-white">Mesa de revisão</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-white/40">Avalie o momento editorial primeiro. Depois acompanhe a edição, faça ajustes e publique no mesmo lugar.</p></div>
        <div className="text-[11px] text-white/30">{clips.length} momentos no fluxo</div>
      </div>
      <div className="-mx-1 mt-5 overflow-x-auto pb-1" role="tablist" aria-label="Etapas da revisão">
        <div className="flex min-w-max gap-2 px-1 sm:grid sm:min-w-0 sm:grid-cols-5">
          {counters.map(item=><button key={item.key} type="button" role="tab" aria-selected={tab===item.key} onClick={()=>setTab(item.key)} className={`relative flex w-[142px] items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition sm:w-auto ${tab===item.key?"border-violet-400/35 bg-violet-500/10 text-white":"border-white/[.08] bg-white/[.025] text-white/45 hover:border-white/15 hover:bg-white/[.045]"}`}><span className={tab===item.key?"text-violet-300":"text-white/30"}>{item.icon}</span><span className="min-w-0"><span className="block text-[10px] uppercase tracking-[.08em]">{item.label}</span><span className="mt-0.5 block text-lg font-semibold text-white">{item.count}</span></span>{tab===item.key&&<span className="absolute inset-x-3 -bottom-px h-px bg-violet-400"/>}</button>)}
        </div>
      </div>
    </div>

    <div className="p-4 sm:p-5 lg:p-6">
      {message&&<div className="mb-4 flex items-center gap-2.5 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3.5 py-3 text-xs text-violet-100"><CircleCheckBig className="h-4 w-4 shrink-0 text-violet-300"/>{message}</div>}
      {(activeWorkerVideo||pendingVariants>0||renderingVariants>0)&&<div className="mb-4 flex flex-col gap-3 rounded-xl border border-white/[.08] bg-white/[.025] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2.5"><span className="relative flex h-2 w-2 shrink-0"><span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${activeWorkerVideo?"bg-emerald-400":"bg-white/30"} opacity-40`}/><span className={`relative inline-flex h-2 w-2 rounded-full ${activeWorkerVideo?"bg-emerald-400":"bg-white/25"}`}/></span><div className="min-w-0"><div className="text-[11px] font-medium text-white/70">{activeWorkerVideo?`Sistema ativo · ${PIPELINE_LABELS[activeWorkerVideo.pipeline_stage||""]||activeWorkerVideo.pipeline_stage}`:"Sistema aguardando novos trabalhos"}</div>{activeWorkerVideo&&<div className="mt-0.5 truncate text-[10px] text-white/30">{activeWorkerVideo.title}</div>}</div></div><div className="flex gap-2">{renderingVariants>0&&<span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] text-sky-300">{renderingVariants} renderizando</span>}{pendingVariants>0&&<span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] text-amber-200">{pendingVariants} na fila</span>}</div></div>}

    {tab==="review"&&<div>
      {!activeReview?<div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center"><CircleCheckBig className="mx-auto h-6 w-6 text-emerald-300/70"/><div className="mt-3 text-sm font-medium text-white/65">Revisão em dia</div><div className="mt-1 text-xs text-white/35">Nenhum momento aguardando sua decisão.</div></div>:<article className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <div className="grid lg:grid-cols-[minmax(320px,.9fr)_1.1fr]">
          <div className="relative min-h-[280px] overflow-hidden bg-black/45 lg:min-h-[420px]">{clipMeta(activeReview).video?.thumbnail_url?<img src={clipMeta(activeReview).video?.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75"/>:<div className="flex h-full min-h-[280px] items-center justify-center text-xs text-white/30">Prévia da fonte indisponível</div>}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/55 to-transparent p-4 pt-16"><div className="flex items-center justify-between text-[11px] text-white/70"><span>Prévia da fonte</span><span>{mmss(activeReview.start_seconds)} → {mmss(activeReview.end_seconds)}</span></div></div></div>
          <div className="flex flex-col p-5 sm:p-6 lg:p-8">{clipSummary(activeReview)}<p className="mt-5 flex-1 text-sm leading-6 text-white/55">{activeReview.caption||"Sem legenda editorial sugerida."}</p><div className="mt-7 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><button type="button" onClick={()=>onApprove(activeReview)} disabled={!!busy} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_10px_28px_rgba(16,185,129,.18)] transition hover:bg-emerald-400 disabled:opacity-40"><Check className="mr-2 h-4 w-4"/>Aprovar</button><button type="button" onClick={()=>setFeedbackTarget({clip:activeReview})} disabled={!!busy} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-2.5 text-xs font-medium text-violet-100 hover:bg-violet-500/15 disabled:opacity-40"><MessageSquareText className="mr-2 h-4 w-4"/>Pedir ajuste</button><button type="button" onClick={()=>onDiscard(activeReview)} disabled={!!busy} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-500/20 px-4 py-2.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"><Trash2 className="mr-2 h-4 w-4"/>Descartar</button></div></div>
        </div>
        {feedbackTarget?.clip.id===activeReview.id&&<div className="border-t border-white/10 p-4"><FeedbackBox busy={!!busy} targetLabel="Momento editorial" onSubmit={submitFeedback} onCancel={()=>setFeedbackTarget(null)}/></div>}
        <div className="flex items-center justify-between border-t border-white/10 px-3 py-3 text-[11px] text-white/40 sm:px-4"><button type="button" onClick={()=>setReviewIndex(index=>Math.max(0,index-1))} disabled={reviewIndex===0} className="inline-flex min-h-9 items-center rounded-lg border border-white/[.08] px-3 disabled:opacity-25"><ChevronLeft className="mr-1 h-3.5 w-3.5"/>Anterior</button><span><strong className="font-medium text-white/70">{reviewIndex+1}</strong> de {review.length}</span><button type="button" onClick={()=>setReviewIndex(index=>Math.min(review.length-1,index+1))} disabled={reviewIndex>=review.length-1} className="inline-flex min-h-9 items-center rounded-lg border border-white/[.08] px-3 disabled:opacity-25">Próximo<ChevronRight className="ml-1 h-3.5 w-3.5"/></button></div>
      </article>}
    </div>}

    {tab!=="review"&&<div className="space-y-5">
      {groups[tab].length===0&&<div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center"><Layers3 className="mx-auto h-6 w-6 text-white/20"/><div className="mt-3 text-sm font-medium text-white/60">Nada por aqui ainda</div><div className="mt-1 text-xs text-white/35">Os cortes aparecem automaticamente quando chegam a esta etapa.</div></div>}
      {groups[tab].map(clip=>{
        const clipVariants=variantsByClip.get(clip.id)||[];
        const readyCount=clipVariants.filter(variant=>variant.variant_key==="editorial_master"&&variant.render_status==="ready").length;
        const fallbackSelected=clipVariants.find(variant=>variant.render_status==="ready")?.id||clipVariants[0]?.id;
        const selectedId=selectedVariantByClip[clip.id]||fallbackSelected;
        const selectedVariant=clipVariants.find(variant=>variant.id===selectedId);
        return <article key={clip.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <div className="flex flex-col gap-4 border-b border-white/[.08] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          {clipSummary(clip,true)}
          {clip.status==="approved"&&(readyCount===1?<span className="inline-flex shrink-0 items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-300"><CircleCheckBig className="mr-1.5 h-3.5 w-3.5"/>Pronto para usar</span>:<span className="shrink-0 text-xs text-white/40">{readyCount}/1 pronto</span>)}
        </div>

        {clip.status==="approved"&&readyCount<1&&<div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-sky-500/15 bg-sky-500/[.05] px-3.5 py-3 sm:mx-5 sm:mt-5"><Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-300"/><div><div className="text-[11px] font-medium text-white/75">{clipVariants.some(variant=>variant.variant_key==="editorial_master"&&variant.render_status==="rendering")?"Renderizando a edição final":"Edição aprovada e na fila"}</div><div className="mt-1 text-[10px] leading-4 text-white/35">{activeWorkerVideo?`O sistema está trabalhando em ${PIPELINE_LABELS[activeWorkerVideo.pipeline_stage||""]||activeWorkerVideo.pipeline_stage}.`:"Aguardando o próximo ciclo de renderização."}</div></div></div>}
        {clip.status==="rejected"?<div className="p-5 text-xs text-white/40">Este momento foi descartado e não será regenerado automaticamente.</div>:<div className="p-4 sm:p-5">
          {clipVariants.length>1&&<div className="mb-4 lg:hidden"><div className="mb-2 text-[10px] uppercase tracking-[.08em] text-white/30">Versões disponíveis</div><div className="flex gap-2 overflow-x-auto pb-1">{clipVariants.map(variant=><button key={variant.id} type="button" onClick={()=>setSelectedVariantByClip(current=>({...current,[clip.id]:variant.id}))} className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] transition ${selectedId===variant.id?"border-violet-400/45 bg-violet-500/15 text-violet-100":"border-white/10 text-white/45"}`}>{LABELS[variant.variant_key]||"Versão"}{selectedId===variant.id&&<Check className="ml-1.5 inline h-3 w-3"/>}</button>)}</div></div>}
          <div className={`grid gap-3 ${clipVariants.length>1?"lg:grid-cols-3":"mx-auto max-w-md"}`}>{ORDER.map(key=>{const variant=clipVariants.find(item=>item.variant_key===key);if(!variant)return <div key={key} className="rounded-xl border border-dashed border-white/10 p-5 text-xs text-white/30">{LABELS[key]} · criando edição…</div>;const currentRevision=revisions.find(revision=>revision.id===variant.current_revision_id);const isSelected=variant.id===selectedId;return <div key={variant.id} className={`${isSelected?"block border-violet-400/45 shadow-[0_14px_40px_rgba(109,40,217,.12)]":"hidden border-white/10 lg:block"} overflow-hidden rounded-2xl border bg-[#090b0f] transition`}>
          <div className="flex items-start justify-between gap-3 border-b border-white/[.08] p-3.5"><button type="button" onClick={()=>setSelectedVariantByClip(current=>({...current,[clip.id]:variant.id}))} className="min-w-0 text-left"><div className="flex items-center gap-2"><span className="truncate text-xs font-medium text-white">{LABELS[key]||"Versão"}</span>{isSelected&&<span className="rounded-full bg-violet-500 p-0.5 text-white"><Check className="h-3 w-3"/></span>}</div><div className="mt-1 line-clamp-1 text-[10px] text-white/30">{DESCRIPTIONS[key]||"Versão renderizada do corte"}</div></button><div className="flex shrink-0 items-center gap-1.5"><Status status={variant.render_status}/><span className="rounded-md border border-white/10 px-1.5 py-1 text-[9px] text-white/35">v{variant.current_revision}</span></div></div>
          {mediaUrls[variant.id]?<video src={mediaUrls[variant.id]} controls playsInline preload="metadata" className="aspect-[9/16] max-h-[560px] w-full bg-black object-contain"/>:<button type="button" onClick={()=>variant.render_status==="ready"&&onWatchVariant(variant)} disabled={variant.render_status!=="ready"||!!busy} className="group flex aspect-[9/16] max-h-[560px] w-full flex-col items-center justify-center bg-black/50 text-xs text-white/35 disabled:cursor-default"><span className={`flex h-12 w-12 items-center justify-center rounded-full border ${variant.render_status==="ready"?"border-white/15 bg-white/10 text-white transition group-hover:scale-105 group-hover:bg-white/15":"border-white/[.06] bg-white/[.03]"}`}>{variant.render_status==="ready"?<Play className="ml-0.5 h-5 w-5"/>:variant.render_status==="rendering"?<Loader2 className="h-5 w-5 animate-spin"/>:<Clock3 className="h-5 w-5"/>}</span><span className="mt-3">{variant.render_status==="ready"?"Carregar prévia":variant.render_status==="rendering"?`Gerando v${variant.current_revision}`:"Aguardando render"}</span></button>}
          <div className="p-3.5"><RenderTelemetry revision={currentRevision} status={variant.render_status}/>{variant.last_error&&<div className="mb-3 rounded-lg border border-red-500/15 bg-red-500/10 px-2.5 py-2 text-[10px] leading-4 text-red-300">{variant.last_error}</div>}<div className="grid grid-cols-2 gap-2">{variant.render_status==="ready"&&<><button type="button" onClick={()=>onWatchVariant(variant)} disabled={!!busy} className={`inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-[11px] font-medium transition disabled:opacity-40 ${isSelected?"bg-violet-500 text-white hover:bg-violet-400":"border border-white/10 text-white/65 hover:bg-white/5"}`}><Play className="mr-1.5 h-3.5 w-3.5"/>Visualizar</button><button type="button" onClick={()=>onDownload(variant)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/10 px-3 text-[11px] text-white/65 hover:bg-white/5"><Download className="mr-1.5 h-3.5 w-3.5"/>Baixar</button></>}{variant.render_status==="ready"&&canPublishInstagram&&onPublish&&(()=>{const pubStatus=publicationStatusByClip?.[clip.id];const done=pubStatus==="published";const running=pubStatus==="publishing"||pubStatus==="processing"||pubStatus==="queued";return <button type="button" onClick={()=>onPublish(clip)} disabled={done||running||!!busy} className="col-span-2 inline-flex min-h-10 items-center justify-center rounded-lg border border-pink-400/25 bg-pink-500/10 px-3 text-[11px] text-pink-200 hover:bg-pink-500/15 disabled:opacity-40"><Instagram className="mr-1.5 h-3.5 w-3.5"/>{done?"Publicado no Instagram":running?"Publicando…":"Publicar no Instagram"}</button>;})()}<button type="button" onClick={()=>setFeedbackTarget({clip,variant})} className="col-span-2 inline-flex min-h-10 items-center justify-center rounded-lg border border-violet-400/20 px-3 text-[11px] text-violet-200 hover:bg-violet-500/10"><MessageSquareText className="mr-1.5 h-3.5 w-3.5"/>Pedir ajuste</button>{variant.render_status==="error"&&currentRevision&&<button type="button" onClick={()=>onRetry(clip,currentRevision)} className="col-span-2 inline-flex min-h-10 items-center justify-center rounded-lg border border-red-500/20 px-3 text-[11px] text-red-300 hover:bg-red-500/10"><RotateCcw className="mr-1.5 h-3.5 w-3.5"/>Tentar novamente</button>}</div></div>
        </div>;})}</div>{selectedVariant&&<div className="mt-4 text-center text-[10px] text-white/25 lg:hidden">Versão selecionada: {LABELS[selectedVariant.variant_key]||"Versão"}</div>}</div>}
        {feedbackTarget?.clip.id===clip.id&&<div className="border-t border-white/[.08] p-4 sm:p-5"><FeedbackBox busy={!!busy} targetLabel={feedbackTarget.variant?LABELS[feedbackTarget.variant.variant_key]||"Versão":"Todas as versões compatíveis"} onSubmit={submitFeedback} onCancel={()=>setFeedbackTarget(null)}/></div>}
        {clip.status!=="rejected"&&<div className="border-t border-white/[.08] p-4 sm:p-5"><button type="button" onClick={()=>setFeedbackTarget({clip})} className="inline-flex min-h-10 items-center rounded-lg border border-white/10 px-3 text-[11px] text-white/55 hover:bg-white/5"><MessageSquareText className="mr-1.5 h-3.5 w-3.5"/>Ajuste geral</button></div>}
        <details className="group border-t border-white/[.08]"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[11px] text-white/50 hover:bg-white/[.025] sm:px-5"><span className="inline-flex items-center"><History className="mr-2 h-3.5 w-3.5"/>Histórico de revisões</span><ChevronRight className="h-3.5 w-3.5 transition group-open:rotate-90"/></summary><div className="space-y-2 border-t border-white/[.06] bg-black/15 p-4 sm:p-5">{revisions.filter(revision=>revision.clip_id===clip.id).sort((a,b)=>b.revision_number-a.revision_number).map(revision=>{const variant=clipVariants.find(item=>item.id===revision.clip_variant_id);return <div key={revision.id} className="rounded-xl border border-white/[.08] bg-white/[.02] p-3.5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[11px] text-white/70">{LABELS[variant?.variant_key||""]||"Versão"} · v{revision.revision_number}{variant?.current_revision_id===revision.id&&" · atual"}</div><Status status={revision.render_status}/></div><div className="mt-1 text-[10px] text-white/30">{fmt(revision.created_at)}</div>{revision.feedback_text&&<div className="mt-2 text-[11px] leading-5 text-white/55">“{revision.feedback_text}”</div>}<div className="mt-2 text-[10px] text-violet-200/60">{revision.interpreted_action?.summary||revision.interpreted_action?.type||"Render inicial"}</div>{mediaUrls[revision.id]&&<video src={mediaUrls[revision.id]} controls playsInline className="mt-3 max-h-[360px] rounded-lg bg-black"/>}{revision.render_status==="ready"&&<div className="mt-3 flex gap-2"><button type="button" onClick={()=>onWatchRevision(revision)} className="inline-flex items-center rounded-md border border-white/10 px-2.5 py-2 text-[10px] text-white/55"><Play className="mr-1 h-3 w-3"/>Prévia</button><button type="button" onClick={()=>onDownload(revision,true)} className="inline-flex items-center rounded-md border border-white/10 px-2.5 py-2 text-[10px] text-white/55"><Download className="mr-1 h-3 w-3"/>Baixar</button></div>}</div>})}{revisions.every(revision=>revision.clip_id!==clip.id)&&<div className="text-[11px] text-white/30">Sem revisões ainda.</div>}</div></details>
        {feedback.filter(item=>item.clip_id===clip.id).slice(0,1).map(item=><div key={item.id} className="border-t border-white/[.06] px-4 py-3 text-[10px] text-white/30 sm:px-5">Último feedback: {item.interpreted_action?.summary||item.feedback_text}</div>)}
      </article>})}
    </div>}
    </div>
  </section>;
}
