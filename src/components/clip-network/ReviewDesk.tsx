/* eslint-disable @typescript-eslint/no-explicit-any -- revision settings are persisted JSON with preset-specific keys. */
import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, History, Instagram, Loader2, MessageSquareText, Play, RotateCcw, Trash2 } from "lucide-react";

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

const LABELS:Record<string,string> = {
  editorial_master:"Edicao final - AI Editor",
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

function Status({status}:{status:string}) {
  const styles = status === "ready" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
    : status === "error" ? "border-red-500/20 bg-red-500/10 text-red-300"
    : status === "rendering" ? "border-sky-500/20 bg-sky-500/10 text-sky-300"
    : "border-white/10 bg-white/5 text-white/55";
  const label = { ready:"Pronto", error:"Erro", rendering:"Renderizando", pending:"Na fila" }[status] || status;
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${styles}`}>{label}</span>;
}

function FeedbackBox({busy,targetLabel,onSubmit,onCancel}:{busy:boolean;targetLabel:string;onSubmit:(text:string)=>void;onCancel:()=>void}) {
  const [text,setText]=useState("");
  return <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[.06] p-4">
    <div className="text-xs font-medium text-white">O que precisa mudar?</div>
    <div className="mt-1 text-[11px] text-violet-200/60">Aplicar em: {targetLabel}</div>
    <textarea autoFocus value={text} onChange={event=>setText(event.target.value)} rows={3} placeholder="Ex.: troque a headline, tire o emoji, baixe a legenda ou faca zoom nessa reacao" className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/25"/>
    <div className="mt-3 flex gap-2"><button onClick={()=>onSubmit(text)} disabled={busy||!text.trim()} className="inline-flex items-center rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-black disabled:opacity-40">{busy&&<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>}Interpretar e gerar revisão</button><button onClick={onCancel} className="rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white/55">Cancelar</button></div>
  </div>;
}

export default function ReviewDesk({clips,variants,revisions,feedback,videos,sources,accounts,mediaUrls,busy,message,onApprove,onDiscard,onFeedback,onWatchVariant,onWatchRevision,onDownload,onRetry,canPublishInstagram,onPublish,publicationStatusByClip}:{
  clips:DeskClip[];variants:DeskVariant[];revisions:DeskRevision[];feedback:DeskFeedback[];videos:DeskVideo[];sources:DeskSource[];accounts:DeskAccount[];mediaUrls:Record<string,string>;busy:string|null;message?:string|null;
  onApprove:(clip:DeskClip)=>void;onDiscard:(clip:DeskClip)=>void;onFeedback:(clip:DeskClip,text:string,variant?:DeskVariant)=>void;onWatchVariant:(variant:DeskVariant)=>void;onWatchRevision:(revision:DeskRevision)=>void;onDownload:(item:DeskVariant|DeskRevision,isRevision?:boolean)=>void;onRetry:(clip:DeskClip,revision:DeskRevision)=>void;
  canPublishInstagram?:boolean;onPublish?:(clip:DeskClip)=>void;publicationStatusByClip?:Record<string,string>;
}) {
  const [tab,setTab]=useState("review");
  const [reviewIndex,setReviewIndex]=useState(0);
  const [feedbackTarget,setFeedbackTarget]=useState<{clip:DeskClip;variant?:DeskVariant}|null>(null);
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
  const approved=clips.filter(clip=>clip.status==="approved"&&(variantsByClip.get(clip.id)||[]).length===0);
  const ready=clips.filter(clip=>clip.status==="approved"&&(variantsByClip.get(clip.id)||[]).some(variant=>variant.variant_key==="editorial_master"&&variant.render_status==="ready"));
  const rendering=clips.filter(clip=>clip.status==="approved"&&!ready.includes(clip)&&!approved.includes(clip));
  const groups:Record<string,DeskClip[]>={review,approved,rendering,ready,discarded};
  const counters=[{key:"review",label:"Revisão",count:review.length},{key:"approved",label:"Aprovados",count:approved.length},{key:"rendering",label:"Renderizando",count:rendering.length},{key:"ready",label:"Prontos",count:ready.length},{key:"discarded",label:"Descartados",count:discarded.length}];
  const activeReview=review[Math.min(reviewIndex,Math.max(0,review.length-1))];

  const activeWorkerVideo=videos.find(video=>
    ["downloading","transcribing","analyzing","rendering"].includes(video.pipeline_stage||"")
  );

  const pendingVariants=variants.filter(variant=>variant.render_status==="pending").length;
  const renderingVariants=variants.filter(variant=>variant.render_status==="rendering").length;

  const submitFeedback=(text:string)=>{if(!feedbackTarget)return;onFeedback(feedbackTarget.clip,text,feedbackTarget.variant);setFeedbackTarget(null);};
  const clipHeader=(clip:DeskClip)=>{
    const video=videoById.get(clip.source_video_id||"");
    return <><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">{Math.round(clip.score)} score</span>{accountById.get(clip.clip_account_id)&&<span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] text-sky-300">{accountById.get(clip.clip_account_id)?.label}</span>}<span className="text-[11px] text-white/35">{mmss(clip.start_seconds)} → {mmss(clip.end_seconds)} · {Math.round(Number(clip.end_seconds||0)-Number(clip.start_seconds||0))}s</span></div><h3 className="mt-3 text-base font-semibold text-white">{clip.on_screen_title||clip.hook||clip.topic||"Momento sem título"}</h3>{clip.hook&&clip.hook!==clip.on_screen_title&&<p className="mt-1 text-xs text-white/55">Hook: {clip.hook}</p>}<p className="mt-2 text-[11px] text-white/35">{sourceById.get(video?.source_id||"")?.label||"Fonte"} · {video?.title||"vídeo"}</p></>;
  };

  return <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5 lg:p-6">
    <div><h2 className="text-base font-semibold text-white">Mesa de revisão</h2><p className="mt-1 text-xs text-white/40">Decida primeiro se o momento funciona. Depois da aprovacao, o AI Editor cria uma edicao nativa especifica para aquele corte.</p></div>
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">{counters.map(item=><button key={item.key} onClick={()=>setTab(item.key)} className={`rounded-xl border px-3 py-3 text-left transition ${tab===item.key?"border-violet-400/40 bg-violet-500/10":"border-white/10 bg-black/20 hover:bg-white/5"}`}><div className="text-[10px] uppercase tracking-wide text-white/35">{item.label}</div><div className="mt-1 text-xl font-semibold text-white">{item.count}</div></button>)}</div>
    {message&&<div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2.5 text-xs text-violet-100">{message}</div>}

    {(activeWorkerVideo||pendingVariants>0||renderingVariants>0)&&
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {activeWorkerVideo
                ? <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40"/>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"/>
                  </span>
                : <span className="h-2 w-2 rounded-full bg-white/25"/>
              }

              <span className="text-[11px] font-medium text-white/80">
                {activeWorkerVideo
                  ? `Worker ativo · ${PIPELINE_LABELS[activeWorkerVideo.pipeline_stage||""]||activeWorkerVideo.pipeline_stage}`
                  : "Worker aguardando trabalho"}
              </span>
            </div>

            {activeWorkerVideo&&
              <div className="mt-1 max-w-2xl truncate text-[10px] text-white/35">
                {activeWorkerVideo.title}
              </div>
            }
          </div>

          <div className="flex flex-wrap gap-2">
            {renderingVariants>0&&
              <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] text-sky-300">
                {renderingVariants} renderizando
              </span>
            }

            {pendingVariants>0&&
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] text-amber-200">
                {pendingVariants} na fila de render
              </span>
            }
          </div>
        </div>
      </div>
    }

    {tab==="review"&&<div className="mt-5">
      {!activeReview?<div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/35">Nenhum momento aguardando revisão.</div>:<div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
        <div className="grid lg:grid-cols-[minmax(300px,.8fr)_1.2fr]">
          <div className="min-h-[260px] bg-black/40">{videoById.get(activeReview.source_video_id||"")?.thumbnail_url?<img src={videoById.get(activeReview.source_video_id||"")?.thumbnail_url} alt="" className="h-full min-h-[260px] w-full object-cover opacity-80"/>:<div className="flex h-full min-h-[260px] items-center justify-center text-xs text-white/30">Preview da fonte indisponível</div>}</div>
          <div className="p-5 lg:p-7">{clipHeader(activeReview)}<p className="mt-4 text-sm leading-6 text-white/55">{activeReview.caption||"Sem caption editorial."}</p><div className="mt-6 flex flex-wrap gap-2"><button onClick={()=>onApprove(activeReview)} disabled={!!busy} className="inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"><Check className="mr-2 h-4 w-4"/>Aprovar</button><button onClick={()=>setFeedbackTarget({clip:activeReview})} disabled={!!busy} className="inline-flex items-center rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-2.5 text-xs font-medium text-violet-200"><MessageSquareText className="mr-2 h-4 w-4"/>Pedir ajuste</button><button onClick={()=>onDiscard(activeReview)} disabled={!!busy} className="inline-flex items-center rounded-xl border border-red-500/20 px-4 py-2.5 text-xs text-red-300"><Trash2 className="mr-2 h-4 w-4"/>Descartar</button></div></div>
        </div>
        {feedbackTarget?.clip.id===activeReview.id&&<div className="border-t border-white/10 p-4"><FeedbackBox busy={!!busy} targetLabel="Momento editorial" onSubmit={submitFeedback} onCancel={()=>setFeedbackTarget(null)}/></div>}
        {review.length>1&&<div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-[11px] text-white/35"><button onClick={()=>setReviewIndex(index=>Math.max(0,index-1))} disabled={reviewIndex===0} className="inline-flex items-center disabled:opacity-25"><ChevronLeft className="mr-1 h-3.5 w-3.5"/>Anterior</button><span>{reviewIndex+1} de {review.length}</span><button onClick={()=>setReviewIndex(index=>Math.min(review.length-1,index+1))} disabled={reviewIndex>=review.length-1} className="inline-flex items-center disabled:opacity-25">Próximo<ChevronRight className="ml-1 h-3.5 w-3.5"/></button></div>}
      </div>}
    </div>}

    {tab!=="review"&&<div className="mt-5 space-y-5">
      {groups[tab].length===0&&<div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/35">Nenhum corte neste estado.</div>}
      {groups[tab].map(clip=>{const clipVariants=variantsByClip.get(clip.id)||[];const readyCount=clipVariants.filter(variant=>variant.render_status==="ready").length;return <article key={clip.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 lg:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>{clipHeader(clip)}</div>
          {clip.status==="approved"&&
            <span className="shrink-0 text-xs text-white/40">{readyCount}/1 pronto</span>
          }
        </div>

        {clip.status==="approved"&&readyCount<1&&
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-3">
            <span className="relative mt-1 flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-35"/>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400"/>
            </span>

            <div>
              <div className="text-[11px] font-medium text-white/75">
                {clipVariants.some(variant=>variant.render_status==="rendering")
                  ? `Renderizando · ${readyCount}/1 pronta`
                  : `Aguardando render · ${readyCount}/1 pronta`}
              </div>

              <div className="mt-1 text-[10px] text-white/35">
                {clipVariants.some(variant=>variant.render_status==="rendering")
                  ? "O worker está gerando as versões deste corte agora."
                  : activeWorkerVideo
                    ? `Na fila. O worker está ocupado em: ${PIPELINE_LABELS[activeWorkerVideo.pipeline_stage||""]||activeWorkerVideo.pipeline_stage}.`
                    : "Na fila aguardando o worker pegar este corte."}
              </div>
            </div>
          </div>
        }
        {clip.status==="rejected"?<div className="mt-4 text-xs text-white/35">Este momento foi descartado e não será regenerado automaticamente.</div>:<div className="mt-5 grid gap-3 lg:grid-cols-2">{ORDER.map(key=>{const variant=clipVariants.find(item=>item.variant_key===key);if(!variant)return <div key={key} className="rounded-xl border border-dashed border-white/10 p-5 text-xs text-white/30">{LABELS[key]} · criando variante…</div>;const currentRevision=revisions.find(revision=>revision.id===variant.current_revision_id);return <div key={variant.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/35">
          {mediaUrls[variant.id]?<video src={mediaUrls[variant.id]} controls playsInline preload="metadata" className="aspect-[9/16] max-h-[560px] w-full bg-black object-contain"/>:<button onClick={()=>variant.render_status==="ready"&&onWatchVariant(variant)} disabled={variant.render_status!=="ready"||!!busy} className="flex aspect-[9/16] max-h-[560px] w-full items-center justify-center bg-black/50 text-xs text-white/35">{variant.render_status==="ready"?<><Play className="mr-2 h-4 w-4"/>Carregar preview</>:variant.render_status==="rendering"?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Gerando v{variant.current_revision}</>:"Preview indisponível"}</button>}
          <div className="p-3"><div className="flex items-center justify-between gap-2"><div className="text-xs font-medium text-white">{LABELS[key]}</div><Status status={variant.render_status}/></div><div className="mt-1 text-[10px] text-white/30">v{variant.current_revision}</div>{variant.last_error&&<div className="mt-2 text-[10px] leading-4 text-red-300">{variant.last_error}</div>}<div className="mt-3 flex flex-wrap gap-2">{variant.render_status==="ready"&&canPublishInstagram&&onPublish&&(()=>{const pubStatus=publicationStatusByClip?.[clip.id];const done=pubStatus==="published";const running=pubStatus==="publishing"||pubStatus==="processing"||pubStatus==="queued";return <button onClick={()=>onPublish(clip)} disabled={done||running||!!busy} className="inline-flex items-center rounded-lg border border-pink-400/25 bg-pink-500/10 px-2.5 py-2 text-[10px] text-pink-200 disabled:opacity-40"><Instagram className="mr-1.5 h-3.5 w-3.5"/>{done?"Publicado":running?"Publicando…":"Publicar IG"}</button>;})()}{variant.render_status==="ready"&&<button onClick={()=>onDownload(variant)} className="inline-flex items-center rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-white/65"><Download className="mr-1.5 h-3.5 w-3.5"/>Baixar</button>}<button onClick={()=>setFeedbackTarget({clip,variant})} className="inline-flex items-center rounded-lg border border-violet-400/20 px-2.5 py-2 text-[10px] text-violet-200"><MessageSquareText className="mr-1.5 h-3.5 w-3.5"/>Pedir ajuste</button>{variant.render_status==="error"&&currentRevision&&<button onClick={()=>onRetry(clip,currentRevision)} className="inline-flex items-center rounded-lg border border-red-500/20 px-2.5 py-2 text-[10px] text-red-300"><RotateCcw className="mr-1.5 h-3.5 w-3.5"/>Tentar novamente</button>}</div></div>
        </div>;})}</div>}
        {feedbackTarget?.clip.id===clip.id&&<div className="mt-4"><FeedbackBox busy={!!busy} targetLabel={feedbackTarget.variant?LABELS[feedbackTarget.variant.variant_key]:"Todas as variantes compatíveis"} onSubmit={submitFeedback} onCancel={()=>setFeedbackTarget(null)}/></div>}
        {clip.status!=="rejected"&&<div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>setFeedbackTarget({clip})} className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white/60"><MessageSquareText className="mr-1.5 h-3.5 w-3.5"/>Ajuste geral</button></div>}
        <details className="mt-4 rounded-xl border border-white/8 bg-black/20"><summary className="flex cursor-pointer list-none items-center px-3 py-2.5 text-[11px] text-white/50"><History className="mr-2 h-3.5 w-3.5"/>Histórico de revisões</summary><div className="space-y-2 border-t border-white/8 p-3">{revisions.filter(revision=>revision.clip_id===clip.id).sort((a,b)=>b.revision_number-a.revision_number).map(revision=>{const variant=clipVariants.find(item=>item.id===revision.clip_variant_id);return <div key={revision.id} className="rounded-lg border border-white/8 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[11px] text-white/70">{LABELS[variant?.variant_key||""]||"Variante"} · v{revision.revision_number}{variant?.current_revision_id===revision.id&&" · atual"}</div><Status status={revision.render_status}/></div><div className="mt-1 text-[10px] text-white/30">{fmt(revision.created_at)}</div>{revision.feedback_text&&<div className="mt-2 text-[11px] text-white/55">“{revision.feedback_text}”</div>}<div className="mt-2 text-[10px] text-violet-200/60">{revision.interpreted_action?.summary||revision.interpreted_action?.type||"Render inicial"}</div>{mediaUrls[revision.id]&&<video src={mediaUrls[revision.id]} controls playsInline className="mt-3 max-h-[360px] rounded-lg bg-black"/>}<div className="mt-2 flex gap-2">{revision.render_status==="ready"&&<><button onClick={()=>onWatchRevision(revision)} className="inline-flex items-center rounded-md border border-white/10 px-2 py-1.5 text-[10px] text-white/55"><Play className="mr-1 h-3 w-3"/>Preview</button><button onClick={()=>onDownload(revision,true)} className="inline-flex items-center rounded-md border border-white/10 px-2 py-1.5 text-[10px] text-white/55"><Download className="mr-1 h-3 w-3"/>Baixar</button></>}</div></div>})}{revisions.every(revision=>revision.clip_id!==clip.id)&&<div className="text-[11px] text-white/30">Sem revisões ainda.</div>}</div></details>
        {feedback.filter(item=>item.clip_id===clip.id).slice(0,1).map(item=><div key={item.id} className="mt-3 text-[10px] text-white/30">Último feedback: {item.interpreted_action?.summary||item.feedback_text}</div>)}
      </article>})}
    </div>}
  </section>;
}
