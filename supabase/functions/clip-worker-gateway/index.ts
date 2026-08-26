/* eslint-disable @typescript-eslint/no-explicit-any -- Worker payloads are allowlisted before persistence. */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { InvalidAiJsonError, RecoverableAiError, parseJsonLoose } from "./ai-json.ts";
import { chooseFallbackAccount, hasTemporalConflict, selectDistinctOpportunities } from "./clip-opportunities.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WORKER_SECRET = Deno.env.get("CLIP_WORKER_SECRET") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = Deno.env.get("CLIP_OPENAI_MODEL") || "gpt-5.4-mini";
const OPENAI_TRANSCRIBE_MODEL = Deno.env.get("CLIP_OPENAI_TRANSCRIBE_MODEL") || "whisper-1";
const BUCKET = Deno.env.get("CLIP_BUCKET") || "clip-network";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const nowIso = () => new Date().toISOString();
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 5;
class TransientAiError extends RecoverableAiError {
  constructor(message: string, readonly status: number) { super(message); this.name = "TransientAiError"; }
}
const isRecoverableAiError = (error: unknown) => error instanceof RecoverableAiError;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function backoffDelay(attempt: number) {
  const base = 1000 * Math.pow(2, attempt - 1);
  return Math.round(base * (0.75 + Math.random() * 0.5));
}
async function withRetry<T>(label: string, fn: () => Promise<T>, tried: string[]): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try { return await fn(); }
    catch (e) {
      lastError = e;
      if (!isRecoverableAiError(e)) { tried.push(`${label}: erro permanente`); throw e; }
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(backoffDelay(attempt));
    }
  }
  const detail = lastError instanceof TransientAiError ? `último status ${lastError.status}` : "última resposta com JSON inválido";
  tried.push(`${label}: ${MAX_ATTEMPTS} tentativas, ${detail}`);
  throw lastError;
}

async function openAiJsonOnce(prompt: string, systemText: string, model: string) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurado");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemText },
        { role: "user", content: prompt },
      ],
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    const msg = `OpenAI (${model}) falhou (${res.status}): ${raw.slice(0, 300)}`;
    if (TRANSIENT_STATUS.has(res.status)) throw new TransientAiError(msg, res.status);
    throw new Error(msg);
  }
  let body: any;
  try { body = JSON.parse(raw); } catch { throw new InvalidAiJsonError(`OpenAI devolveu resposta não-JSON: ${raw.slice(0, 300)}`); }
  return parseJsonLoose(body.choices?.[0]?.message?.content || "{}");
}

async function openAiJson(prompt: string, systemText: string) {
  const tried: string[] = [];
  try {
    return await withRetry(`openai:${OPENAI_MODEL}`, () => openAiJsonOnce(prompt, systemText, OPENAI_MODEL), tried);
  } catch (e) {
    const detail = tried.length ? ` [rotas tentadas: ${tried.join(" | ")}]` : "";
    throw new Error(`${String((e as Error)?.message || e)}${detail}`);
  }
}

function base64Bytes(value: string) {
  const binary = atob(value || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function openAiTranscribeOnce(audioBase64: string, mimeType: string) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurado");
  const form = new FormData();
  const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : "mp3";
  form.append("file", new Blob([base64Bytes(audioBase64)], { type: mimeType }), `chunk.${ext}`);
  form.append("model", OPENAI_TRANSCRIBE_MODEL);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  const raw = await res.text();
  if (!res.ok) {
    const msg = `OpenAI transcription (${OPENAI_TRANSCRIBE_MODEL}) falhou (${res.status}): ${raw.slice(0, 300)}`;
    if (TRANSIENT_STATUS.has(res.status)) throw new TransientAiError(msg, res.status);
    throw new Error(msg);
  }
  let body: any;
  try { body = JSON.parse(raw); } catch { throw new InvalidAiJsonError(`OpenAI transcription devolveu resposta não-JSON: ${raw.slice(0, 300)}`); }
  const segments = (body.segments || []).map((s: any) => ({
    start: Number(s.start) || 0,
    end: Number(s.end) || 0,
    text: String(s.text || "").trim(),
  })).filter((s: any) => s.text);
  if (!segments.length && body.text) {
    const duration = Number(body.duration) || 0;
    return [{ start: 0, end: duration, text: String(body.text).trim() }].filter((s) => s.text);
  }
  return segments;
}

async function openAiTranscribe(audioBase64: string, mimeType: string) {
  const tried: string[] = [];
  try {
    return await withRetry(`openai-transcribe:${OPENAI_TRANSCRIBE_MODEL}`, () => openAiTranscribeOnce(audioBase64, mimeType), tried);
  } catch (e) {
    const detail = tried.length ? ` [rotas tentadas: ${tried.join(" | ")}]` : "";
    throw new Error(`${String((e as Error)?.message || e)}${detail}`);
  }
}

const VIDEO_FIELDS = new Set(["pipeline_stage","media_status","stage_detail","duration_seconds","transcript","transcript_status","clips_generated","last_error","locked_by","locked_at","lease_expires_at","next_retry_at","processing_finished_at","updated_at"]);
const CLIP_FIELDS = new Set(["render_status","rendered_storage_path","rendered_url","last_error","locked_by","lease_expires_at","render_attempts","status","updated_at"]);
const pick = (patch: Record<string, unknown>, allow: Set<string>) => Object.fromEntries(Object.entries(patch || {}).filter(([k]) => allow.has(k)));

async function loadContext(sourceId: string) {
  const { data: source } = await admin.from("clip_sources").select("*").eq("id", sourceId).maybeSingle();
  if (!source) throw new Error("Fonte do vídeo não existe mais");
  const { data: network } = await admin.from("clip_networks").select("*").eq("id", source.network_id).maybeSingle();
  if (!network) throw new Error("Rede do vídeo não existe mais");
  const { data: accounts } = await admin.from("clip_accounts").select("id,label,niche,tone,rules,daily_limit,active").eq("network_id", network.id).eq("active", true);
  if (!accounts?.length) throw new Error("Nenhuma conta editorial ativa nesta rede");
  return { source, network, accounts };
}
async function countPlayableClips(sourceVideoId: string) {
  const { data, error } = await admin.from("clips").select("rendered_storage_path,rendered_url").eq("source_video_id", sourceVideoId).eq("render_status", "ready");
  if (error) throw error;
  return (data || []).filter((clip) => clip.rendered_storage_path || clip.rendered_url).length;
}
async function syncPlayableClipCount(sourceVideoId: string) {
  const count = await countPlayableClips(sourceVideoId);
  const { error } = await admin.from("clip_source_videos").update({ clips_generated: count, updated_at: nowIso() }).eq("id", sourceVideoId);
  if (error) throw error;
  return count;
}

async function orchestrate(_network: Record<string, any>, accounts: Record<string, any>[], transcript: { segments?: { start: number; end: number; text: string }[]; duration?: number }) {
  const timestamped = (transcript.segments || []).map((s) => `[${Number(s.start).toFixed(1)}-${Number(s.end).toFixed(1)}] ${s.text}`).join("\n").slice(0, 240_000);
  const opportunityPrompt = [
    "Você é um Creative Strategist especializado em encontrar oportunidades de short-form em vídeos long-form.",
    "Nesta etapa IGNORE contas, nichos e routing. Analise o vídeo por mérito editorial próprio.",
    "Crie um pool exploratório de até 20 momentos para que o sistema selecione os 10 melhores e realmente distintos.",
    "Em um vídeo rico de 30–60 minutos, procure ativamente várias oportunidades ao longo de toda a duração; não retorne zero apenas porque os momentos não são perfeitos ou não chegam a 90/100.",
    "",
    "REGRAS:",
    "- Procure conflito, reação, história, revelação, opinião, humor, tensão, curiosidade, transformação, bastidor, informação forte e interação entre pessoas.",
    "- Não limite a busca a fitness ou ao tema aparente de uma conta editorial.",
    "- Os primeiros 1–3 segundos precisam conter um hook real e forte, sem saudação, introdução morna ou segundos mortos.",
    "- O corte precisa funcionar sozinho: hook → desenvolvimento necessário → payoff/conclusão.",
    "- Nunca comece ou termine no meio de uma frase, explicação ou pensamento.",
    "- Duração permitida: 5–90 segundos. Use somente o tempo necessário.",
    "- Não invente, reescreva ou reorganize falas; use timestamps existentes.",
    "- Cada candidato deve representar um acontecimento diferente. Não repita a mesma conversa com início ou final alternativo.",
    "- Prefira oportunidades distribuídas pelo vídeo quando houver qualidade.",
    "- Score real de 0–100 considera hook, retenção provável, clareza standalone, payoff e compartilhamento.",
    "- Qualidade continua acima de quantidade, mas este pool serve para avaliação manual: seja exploratório, não excessivamente conservador.",
    "- Caption curta e natural, sem inventar fatos.",
    "- on_screen_title com no máximo 9 palavras.",
    "",
    "TRANSCRIÇÃO COM TIMESTAMPS:", timestamped, "",
    'Responda SOMENTE JSON: {"clips":[{"start_seconds":0,"end_seconds":40,"topic":"","hook":"","on_screen_title":"","caption":"","score":85,"reason":""}]}'
  ].join("\n");
  const parsed = await openAiJson(opportunityPrompt, "Encontre oportunidades de short-form antes de pensar em conta editorial. Explore o vídeo inteiro, preserve falas e responda apenas JSON.");
  const opportunities = selectDistinctOpportunities(parsed.clips || [], transcript.duration, 10);
  if (!opportunities.length) return [];
  const fallbackAccount = chooseFallbackAccount(accounts);
  const accountIds = new Set(accounts.map((a) => a.id));
  const routingPrompt = [
    "Roteie cada momento abaixo para exatamente uma conta editorial ativa.",
    "Não descarte nenhum momento. Se não houver encaixe perfeito, indique a conta mais ampla/próxima; o sistema possui fallback seguro.", "",
    "CONTAS ATIVAS:",
    ...accounts.map((account) => `- id=${account.id} | ${account.label} | nicho=${account.niche} | tom=${account.tone || "natural"} | regras=${JSON.stringify(account.rules || {})}`), "",
    "MOMENTOS:",
    ...opportunities.map((clip, index) => `${index}: ${JSON.stringify({ start_seconds: clip.start_seconds, end_seconds: clip.end_seconds, topic: clip.topic, hook: clip.hook, reason: clip.reason })}`), "",
    'Responda SOMENTE JSON: {"routes":[{"moment_index":0,"account_id":"uuid"}]}'
  ].join("\n");
  const routed = await openAiJson(routingPrompt, "Você faz routing editorial depois que os momentos já foram escolhidos. Roteie todos, sem removê-los, e responda apenas JSON.");
  const routes = new Map<number,string>();
  for (const route of routed.routes || []) {
    const index = Number(route.moment_index);
    if (Number.isInteger(index) && accountIds.has(route.account_id)) routes.set(index, route.account_id);
  }
  return opportunities.map((clip, index) => ({ ...clip, account_id: routes.get(index) || fallbackAccount.id }));
}

async function autoApprove(network: Record<string, any>, accounts: Record<string, any>[], clips: any[]) {
  if (network.approval_mode !== "auto") return [];
  const minScore = Number(network.min_score || 0);
  const today = nowIso().slice(0, 10);
  const approved: any[] = [];
  for (const account of accounts) {
    const { count } = await admin.from("clips").select("id", { count: "exact", head: true }).eq("clip_account_id", account.id).in("status", ["approved","scheduled","published"]).gte("created_at", `${today}T00:00:00.000Z`);
    const cap = Math.min(Number(account.daily_limit || 10), Number(network.daily_limit || 10));
    let room = Math.max(0, cap - (count || 0));
    if (!room) continue;
    const eligible = clips.filter((c) => c.clip_account_id === account.id && c.status === "candidate" && Number(c.score) >= minScore).sort((a,b) => Number(b.score)-Number(a.score));
    for (const clip of eligible) {
      if (room <= 0) break;
      const { error } = await admin.from("clips").update({ status: "approved", updated_at: nowIso() }).eq("id", clip.id).eq("status", "candidate");
      if (!error) { approved.push({ ...clip, status: "approved" }); room -= 1; }
    }
  }
  return approved;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!WORKER_SECRET) return json({ error: "CLIP_WORKER_SECRET não configurado" }, 500);
    const provided = req.headers.get("x-clip-worker-secret") || "";
    if (provided !== WORKER_SECRET) return json({ error: "unauthorized" }, 401);
    const { action, payload = {} } = await req.json();
    switch (action) {
      case "ping": return json({ ok: true, openai: Boolean(OPENAI_API_KEY), model: OPENAI_MODEL, transcribe_model: OPENAI_TRANSCRIBE_MODEL, bucket: BUCKET });
      case "recover_stuck": {
        const { data, error } = await admin.rpc("clip_recover_stuck_jobs"); if (error) throw error; return json({ recovered: data ?? 0 });
      }
      case "claim": {
        const { data, error } = await admin.rpc("clip_claim_source_video", { p_worker_id: payload.worker_id, p_lease_secs: payload.lease_secs }); if (error) throw error; return json({ job: Array.isArray(data) ? data[0] ?? null : data ?? null });
      }
      case "context": return json(await loadContext(payload.source_id));
      case "touch_lease": {
        const { error } = await admin.rpc("clip_touch_lease", { p_video_id: payload.video_id, p_worker_id: payload.worker_id, p_stage: payload.stage, p_detail: payload.detail ?? null, p_lease_secs: payload.lease_secs }); if (error) throw error; return json({ ok: true });
      }
      case "update_video": {
        const patch = { ...pick(payload.patch, VIDEO_FIELDS), updated_at: nowIso() }; const { error } = await admin.from("clip_source_videos").update(patch).eq("id", payload.video_id); if (error) throw error; return json({ ok: true });
      }
      case "update_clip": {
        const patch = { ...pick(payload.patch, CLIP_FIELDS), updated_at: nowIso() };
        const { data: clip, error } = await admin.from("clips").update(patch).eq("id", payload.clip_id).select("source_video_id").maybeSingle();
        if (error) throw error;
        if (clip?.source_video_id && ["ready","error"].includes(String(patch.render_status || ""))) await syncPlayableClipCount(clip.source_video_id);
        return json({ ok: true });
      }
      case "transcribe_chunk": {
        const segments = await openAiTranscribe(String(payload.audio_base64 || ""), String(payload.mime_type || "audio/mpeg"));
        return json({ segments });
      }
      case "analyze_and_save": {
        const job = payload.job; const transcript = payload.transcript; const { network, accounts } = await loadContext(job.source_id); const candidates = await orchestrate(network, accounts, transcript);
        if (candidates.length) {
          const rows = candidates.map((c:any)=>({ user_id:job.user_id,source_video_id:job.id,clip_account_id:c.account_id,dedupe_key:`moment:${Math.round(c.start_seconds)}:${Math.round(c.end_seconds)}`,start_seconds:c.start_seconds,end_seconds:c.end_seconds,transcript_excerpt:(transcript.segments||[]).filter((s:any)=>s.end>c.start_seconds&&s.start<c.end_seconds).map((s:any)=>s.text).join(" ").slice(0,4000),topic:c.topic||null,hook:c.hook||null,on_screen_title:c.on_screen_title||null,caption:c.caption||null,score:Math.max(0,Math.min(100,c.score)),ai_reason:c.reason||null,status:"candidate",render_status:"pending",updated_at:nowIso()}));
          const { data: existing, error: readError } = await admin.from("clips").select("dedupe_key,start_seconds,end_seconds").eq("source_video_id", job.id); if (readError) throw readError;
          const known = new Set((existing||[]).map((r:any)=>r.dedupe_key));
          const knownRanges=(existing||[]).map((row:any)=>({start_seconds:Number(row.start_seconds),end_seconds:Number(row.end_seconds)})).filter((row:any)=>Number.isFinite(row.start_seconds)&&Number.isFinite(row.end_seconds));
          const fresh:any[]=[];
          for (const row of rows) { if (known.has(row.dedupe_key)||knownRanges.some((range:any)=>hasTemporalConflict(row,range))) continue; known.add(row.dedupe_key); knownRanges.push(row); fresh.push(row); }
          if (fresh.length) { const { error } = await admin.from("clips").insert(fresh); if (error) throw error; }
        }
        const { data: clips } = await admin.from("clips").select("*").eq("source_video_id", job.id); const approved = await autoApprove(network, accounts, clips || []); return json({ clips: clips || [], approved });
      }
      case "next_render_backlog": {
        const { data: rows, error } = await admin.from("clips").select("*, clip_source_videos(*)").eq("status","approved").eq("render_status","pending").not("source_video_id","is",null).lt("render_attempts",4).order("score",{ascending:false}).limit(1);
        if (error) throw error; const clip=rows?.[0]; const video=clip?.clip_source_videos; if (!clip||!video?.transcript||!video.rights_confirmed) return json({clip:null});
        const { data: source } = await admin.from("clip_sources").select("*").eq("id",video.source_id).maybeSingle(); if (!source?.rights_confirmed) return json({clip:null}); return json({clip,video,source});
      }
      case "signed_upload": {
        const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(payload.path,{upsert:true}); if(error) throw error; return json({path:payload.path,signed_url:data.signedUrl,token:data.token});
      }
      case "signed_download": {
        const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(payload.path,Number(payload.expires_in||3600)); if(error) throw error; return json({signed_url:data.signedUrl});
      }
      case "fail_job": {
        const attempts=Number(payload.attempts||0); const terminal=payload.retryable===false||attempts>=4;
        const { error } = await admin.from("clip_source_videos").update({ pipeline_stage:terminal?"error":"discovered",media_status:terminal?"error":"waiting_for_media",stage_detail:null,last_error:String(payload.error||"").slice(0,2000),locked_by:null,locked_at:null,lease_expires_at:null,next_retry_at:terminal?null:new Date(Date.now()+Math.min(30,attempts*5+2)*60000).toISOString(),processing_finished_at:terminal?nowIso():null,updated_at:nowIso() }).eq("id",payload.video_id);
        if(error) throw error; return json({ok:true,terminal});
      }
      case "finish_job": {
        const playable=await countPlayableClips(payload.video_id); const candidates=Math.max(0,Number(payload.candidates_count||0)); const approved=Math.max(0,Number(payload.approved_count||0)); const renderFailed=approved>0&&playable===0;
        const detail=playable>0?`${playable} ${playable===1?"corte pronto":"cortes prontos"}`:candidates>0?`${candidates} ${candidates===1?"candidato aguardando aprovação":"candidatos aguardando aprovação"}`:"análise concluída: nenhum corte selecionado";
        const { error } = await admin.from("clip_source_videos").update({ pipeline_stage:renderFailed?"error":"done",media_status:renderFailed?"error":"processed",stage_detail:renderFailed?null:detail,clips_generated:playable,last_error:renderFailed?"Havia cortes aprovados, mas nenhum MP4 foi renderizado.":null,locked_by:null,locked_at:null,lease_expires_at:null,next_retry_at:renderFailed?new Date(Date.now()+120000).toISOString():null,processing_finished_at:nowIso(),updated_at:nowIso() }).eq("id",payload.video_id);
        if(error) throw error; return json({ok:true,clips_generated:playable,outcome:renderFailed?"render_failed":playable>0?"clips_ready":"no_clips_ready"});
      }
      default: return json({ error: `ação desconhecida: ${action}` }, 400);
    }
  } catch (e) { return json({ error: String((e as Error)?.message || e) }, 500); }
});