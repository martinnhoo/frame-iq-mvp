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
  form.append("timestamp_granularities[]", "word");
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
  let segments = (body.segments || []).map((s: any) => ({
    start: Number(s.start) || 0,
    end: Number(s.end) || 0,
    text: String(s.text || "").trim(),
  })).filter((s: any) => s.text);

  const words = (body.words || []).map((w: any) => ({
    start: Number(w.start) || 0,
    end: Number(w.end) || 0,
    word: String(w.word || "").trim(),
  })).filter((w: any) => w.word);

  const duration = Number(body.duration)
    || Number(words.at(-1)?.end)
    || Number(segments.at(-1)?.end)
    || 0;

  if (!segments.length && body.text) {
    segments = [{
      start: 0,
      end: duration,
      text: String(body.text).trim(),
    }].filter((s) => s.text);
  }

  return {
    text: String(body.text || "").trim(),
    segments,
    words,
    duration,
  };
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
const REVISION_FIELDS = new Set(["render_status","rendered_storage_path","rendered_url","last_error","locked_by","lease_expires_at","render_attempts","parameters","updated_at"]);
const VARIANT_KEYS = ["blur_caption","zoom_caption","zoom_clean"] as const;
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

async function ensureClipVariants(clips: Record<string, any>[]) {
  const eligible = [...new Map(
    clips
      .filter((clip) => clip?.id && clip?.user_id && clip?.source_video_id && clip?.status === "approved")
      .map((clip) => [clip.id, clip]),
  ).values()];
  if (!eligible.length) return { variants: [], revisions: [] };

  const rows = eligible.flatMap((clip) => VARIANT_KEYS.map((variantKey) => ({
    user_id: clip.user_id,
    clip_id: clip.id,
    variant_key: variantKey,
  })));
  const { error: upsertError } = await admin.from("clip_variants")
    .upsert(rows, { onConflict: "clip_id,variant_key", ignoreDuplicates: true });
  if (upsertError) throw upsertError;

  const { data, error } = await admin.from("clip_variants")
    .select("*")
    .in("clip_id", eligible.map((clip) => clip.id))
    .order("created_at", { ascending: true });
  if (error) throw error;
  const variants = data || [];
  const { data: existing, error: revisionReadError } = await admin.from("clip_revisions")
    .select("*")
    .in("clip_variant_id", variants.map((variant) => variant.id));
  if (revisionReadError) throw revisionReadError;
  const withRevision = new Set((existing || []).map((revision) => revision.clip_variant_id));
  const missing = variants.filter((variant) => !withRevision.has(variant.id)).map((variant) => ({
    user_id: variant.user_id,
    clip_id: variant.clip_id,
    clip_variant_id: variant.id,
    revision_number: 1,
    parameters: variant.parameters || {},
    interpreted_action: { type: "initial_render", summary: "Render inicial" },
  }));
  if (missing.length) {
    const { error: insertError } = await admin.from("clip_revisions").upsert(missing, { onConflict: "clip_variant_id,revision_number", ignoreDuplicates: true });
    if (insertError) throw insertError;
  }
  const { data: revisions, error: finalReadError } = await admin.from("clip_revisions")
    .select("*")
    .in("clip_variant_id", variants.map((variant) => variant.id))
    .order("created_at", { ascending: true });
  if (finalReadError) throw finalReadError;
  for (const variant of variants) {
    if (variant.current_revision_id) continue;
    const first = (revisions || []).find((revision) => revision.clip_variant_id === variant.id && revision.revision_number === 1);
    if (first) {
      const { error: pointerError } = await admin.from("clip_variants").update({ current_revision_id: first.id, current_revision: 1, updated_at: nowIso() }).eq("id", variant.id).is("current_revision_id", null);
      if (pointerError) throw pointerError;
      variant.current_revision_id = first.id;
    }
  }
  return { variants, revisions: revisions || [] };
}

async function ensureAllApprovedVariants() {
  const { data, error } = await admin.from("clips")
    .select("id,user_id,source_video_id,status")
    .eq("status", "approved")
    .not("source_video_id", "is", null)
    .limit(200);
  if (error) throw error;
  return ensureClipVariants(data || []);
}

async function orchestrate(
  _network: Record<string, any>,
  accounts: Record<string, any>[],
  transcript: {
    segments?: {
      start:number;
      end:number;
      text:string;
    }[];
    duration?:number;
  },
) {
  const segments =
    transcript.segments || [];

  const timestamped =
    segments
      .map(
        segment =>
          `[${Number(segment.start).toFixed(1)}-${Number(segment.end).toFixed(1)}] ${segment.text}`
      )
      .join("\n")
      .slice(0,240_000);


  // ----------------------------------------------------------
  // PASSAGEM 1 — CAÇADOR DE MOMENTOS
  // ----------------------------------------------------------

  const discoveryPrompt=[
    "Você é um editor de short-form de altíssimo nível.",
    "Analise o vídeo inteiro e encontre oportunidades reais para Reels, Shorts e TikTok.",
    "",
    "OBJETIVO:",
    "- Gere entre 15 e 20 candidatos quando houver material suficiente.",
    "- Nesta etapa seja exploratório. O editor-chefe fará a seleção final depois.",
    "",
    "O QUE É UM BOM CORTE:",
    "- O primeiro 1–3 segundos já têm algo acontecendo.",
    "- Funciona sem precisar assistir ao vídeo anterior.",
    "- Existe desenvolvimento e payoff.",
    "- Tem reação, conflito, humor, tensão, surpresa, opinião forte, história, informação ou interação interessante.",
    "- A fala inicial é utilizável como hook real — não invente hook.",
    "- Começa e termina em limites naturais da conversa.",
    "",
    "REJEITE COMO IDEIA:",
    "- introdução morna;",
    "- frase isolada que parece interessante no texto mas não vira história;",
    "- momento que depende demais do contexto anterior;",
    "- conversa sem conclusão;",
    "- repetição do mesmo acontecimento;",
    "- trecho que começa depois do momento interessante;",
    "- trecho que termina antes do payoff.",
    "",
    "REGRAS:",
    "- duração entre 5 e 90 segundos;",
    "- use somente timestamps e falas reais;",
    "- nunca invente ou reorganize falas;",
    "- distribua oportunidades ao longo de todo o vídeo;",
    "- score inicial de 0–100;",
    "- on_screen_title com no máximo 9 palavras.",
    "",
    "TRANSCRIÇÃO:",
    timestamped,
    "",
    'Responda SOMENTE JSON: {"clips":[{"start_seconds":0,"end_seconds":40,"topic":"","hook":"","on_screen_title":"","caption":"","score":80,"reason":""}]}',
  ].join("\n");

  const discovered=
    await openAiJson(
      discoveryPrompt,
      "Você encontra oportunidades reais de short-form em vídeo longo. Seja rigoroso com timestamps e responda apenas JSON.",
    );

  // Aqui agora preservamos até 20.
  const exploration=
    selectDistinctOpportunities(
      discovered.clips || [],
      transcript.duration,
      20,
    );

  if(!exploration.length){
    return [];
  }


  // ----------------------------------------------------------
  // PASSAGEM 2 — EDITOR-CHEFE / CRÍTICO
  // ----------------------------------------------------------

  const candidatePayload=
    exploration.map(
      (clip:any,index:number)=>{
        const start=
          Number(clip.start_seconds);

        const end=
          Number(clip.end_seconds);

        const opening=
          segments
            .filter(
              segment =>
                Number(segment.end) > start &&
                Number(segment.start) <
                  Math.min(end,start+4)
            )
            .map(segment=>segment.text)
            .join(" ")
            .slice(0,700);

        const excerpt=
          segments
            .filter(
              segment =>
                Number(segment.end) >
                  start-3 &&
                Number(segment.start) <
                  end+3
            )
            .map(segment=>segment.text)
            .join(" ")
            .slice(0,1800);

        return {
          moment_index:index,
          start_seconds:start,
          end_seconds:end,
          duration_seconds:
            Math.round(
              (end-start)*10
            )/10,
          original_score:
            Number(clip.score)||0,
          hook:clip.hook||"",
          topic:clip.topic||"",
          title:
            clip.on_screen_title||"",
          opening_4_seconds:opening,
          transcript_excerpt:excerpt,
        };
      }
    );

  const rankingPrompt=[
    "Você agora é o EDITOR-CHEFE de uma operação profissional de short-form.",
    "Uma primeira IA encontrou candidatos. Sua função é ser muito mais crítica.",
    "",
    "Avalie se cada momento realmente merece ser publicado.",
    "",
    "PESO DA NOTA:",
    "- 30: hook real nos primeiros segundos;",
    "- 20: payoff/conclusão;",
    "- 20: funciona sozinho sem contexto;",
    "- 15: emoção, humor, tensão, reação ou curiosidade;",
    "- 10: facilidade de editar em um short forte;",
    "- 5: novidade em relação aos outros candidatos.",
    "",
    "PENALIZE FORTEMENTE:",
    "- começa tarde demais;",
    "- começa antes demais e demora para chegar ao ponto;",
    "- termina sem conclusão;",
    "- depende de explicação anterior;",
    "- só é interessante lendo a frase fora do vídeo;",
    "- mesmo assunto/momento de outro candidato;",
    "- conversa genérica;",
    "- payoff fraco.",
    "",
    "IMPORTANTE:",
    "- Não tente salvar candidato ruim.",
    "- keep=false é esperado para momentos medianos.",
    "- 65 significa publicável.",
    "- 75 significa bom.",
    "- 85+ deve ser raro e realmente forte.",
    "- Não premie o score da primeira IA; julgue novamente.",
    "",
    "CANDIDATOS:",
    JSON.stringify(candidatePayload),
    "",
    'Responda SOMENTE JSON: {"ranked":[{"moment_index":0,"editorial_score":78,"keep":true,"hook_score":24,"payoff_score":16,"standalone_score":17,"reason":"..."}]}',
  ].join("\n");

  let rankedPool=
    exploration.map(
      (clip:any)=>({
        ...clip,
        editorial_keep:true,
      })
    );

  try{
    const ranked=
      await openAiJson(
        rankingPrompt,
        "Você é um editor-chefe extremamente seletivo. Julgue qualidade real de short-form e responda apenas JSON.",
      );

    const evaluations=
      new Map<number,any>();

    for(
      const evaluation of
      ranked.ranked || []
    ){
      const index=
        Number(
          evaluation.moment_index
        );

      if(Number.isInteger(index)){
        evaluations.set(
          index,
          evaluation
        );
      }
    }

    rankedPool=
      exploration
        .map(
          (clip:any,index:number)=>{
            const evaluation=
              evaluations.get(index);

            if(!evaluation){
              return {
                ...clip,
                editorial_keep:true,
              };
            }

            const editorialScore=
              Math.max(
                0,
                Math.min(
                  100,
                  Number(
                    evaluation.editorial_score
                  ) ||
                  Number(clip.score) ||
                  0
                )
              );

            return {
              ...clip,

              // A nota do editor-chefe substitui a nota
              // exploratória da primeira IA.
              score:editorialScore,

              editorial_keep:
                evaluation.keep !== false,

              reason:
                evaluation.reason
                  ? `Editor-chefe: ${String(evaluation.reason)}`
                  : clip.reason,
            };
          }
        )
        .sort(
          (a:any,b:any)=>
            Number(b.score)-
            Number(a.score)
        );
  }catch(error){
    // Falha do crítico não deve perder um vídeo inteiro.
    console.warn(
      "[editorial-ranker] fallback para scores da descoberta:",
      String(
        (error as Error)?.message ||
        error
      )
    );
  }


  // Qualidade acima de quantidade.
  // Se só 6 forem realmente bons, mostramos 6.
  const strongCandidates=
    rankedPool.filter(
      (clip:any)=>
        clip.editorial_keep !== false &&
        Number(clip.score) >= 65
    );

  const finalPool=
    strongCandidates.length
      ? strongCandidates
      : rankedPool.slice(
          0,
          Math.min(
            5,
            rankedPool.length
          )
        );

  const opportunities=
    selectDistinctOpportunities(
      finalPool,
      transcript.duration,
      10,
    );

  if(!opportunities.length){
    return [];
  }


  // ----------------------------------------------------------
  // PASSAGEM 3 — ROUTING DE CONTA
  // ----------------------------------------------------------

  const fallbackAccount=
    chooseFallbackAccount(accounts);

  const accountIds=
    new Set(
      accounts.map(
        account=>account.id
      )
    );

  const routingPrompt=[
    "Roteie cada momento abaixo para exatamente uma conta editorial ativa.",
    "Não descarte nenhum momento nesta etapa.",
    "",
    "CONTAS ATIVAS:",
    ...accounts.map(
      account =>
        `- id=${account.id} | ${account.label} | nicho=${account.niche} | tom=${account.tone || "natural"} | regras=${JSON.stringify(account.rules || {})}`
    ),
    "",
    "MOMENTOS:",
    ...opportunities.map(
      (clip:any,index:number)=>
        `${index}: ${JSON.stringify({
          start_seconds:
            clip.start_seconds,
          end_seconds:
            clip.end_seconds,
          topic:clip.topic,
          hook:clip.hook,
          score:clip.score,
          reason:clip.reason,
        })}`
    ),
    "",
    'Responda SOMENTE JSON: {"routes":[{"moment_index":0,"account_id":"uuid"}]}',
  ].join("\n");

  const routed=
    await openAiJson(
      routingPrompt,
      "Você faz somente routing editorial depois que os momentos já foram escolhidos. Responda apenas JSON.",
    );

  const routes=
    new Map<number,string>();

  for(
    const route of
    routed.routes || []
  ){
    const index=
      Number(route.moment_index);

    if(
      Number.isInteger(index) &&
      accountIds.has(
        route.account_id
      )
    ){
      routes.set(
        index,
        route.account_id
      );
    }
  }

  return opportunities.map(
    (clip:any,index:number)=>({
      ...clip,
      account_id:
        routes.get(index) ||
        fallbackAccount.id,
    })
  );
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
      case "update_revision": {
        const patch = { ...pick(payload.patch, REVISION_FIELDS), updated_at: nowIso() };
        const { data: revision, error } = await admin.from("clip_revisions")
          .update(patch).eq("id", payload.revision_id).select("clip_id").maybeSingle();
        if (error) throw error;
        if (!revision) return json({ error: "revision_not_found" }, 404);
        const { data: clip, error: clipError } = await admin.from("clips")
          .select("render_status,source_video_id").eq("id", revision.clip_id).maybeSingle();
        if (clipError) throw clipError;
        if (clip?.source_video_id && ["ready","error"].includes(String(patch.render_status || ""))) {
          await syncPlayableClipCount(clip.source_video_id);
        }
        return json({ ok: true, clip_render_status: clip?.render_status || "pending" });
      }
      case "transcribe_chunk": {
        const transcription = await openAiTranscribe(
          String(payload.audio_base64 || ""),
          String(payload.mime_type || "audio/mpeg"),
        );
        return json(transcription);
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
        const { data: clips } = await admin.from("clips").select("*").eq("source_video_id", job.id);
        const approved = await autoApprove(network, accounts, clips || []);
        const approvedClips = [...new Map([...(clips || []).filter((clip) => clip.status === "approved"), ...approved].map((clip) => [clip.id, clip])).values()];
        const ensured = await ensureClipVariants(approvedClips);
        return json({ clips: clips || [], approved, variants: ensured.variants, revisions: ensured.revisions });
      }
      case "next_render_backlog": {
        await ensureAllApprovedVariants();
        const { data: queued, error: queueError } = await admin.from("clip_revisions")
          .select("clip_id,clips!inner(status)").eq("clips.status","approved")
          .in("render_status", ["pending","error"]).lt("render_attempts",4)
          .order("created_at", { ascending: true }).limit(1);
        if (queueError) throw queueError;
        const clipId = queued?.[0]?.clip_id;
        if (!clipId) return json({ clip: null });
        const { data: clip, error } = await admin.from("clips").select("*, clip_source_videos(*)").eq("id",clipId).eq("status","approved").maybeSingle();
        if (error) throw error;
        const video = clip?.clip_source_videos;
        if (!clip || !video?.transcript || !video.rights_confirmed) return json({clip:null});
        const { data: source } = await admin.from("clip_sources").select("*").eq("id",video.source_id).maybeSingle();
        if (!source?.rights_confirmed) return json({clip:null});
        const { data: variants, error: variantError } = await admin.from("clip_variants").select("*").eq("clip_id",clip.id);
        if (variantError) throw variantError;
        const { data: revisions, error: revisionError } = await admin.from("clip_revisions").select("*")
          .eq("clip_id",clip.id).in("render_status",["pending","error"]).lt("render_attempts",4).order("created_at",{ascending:true});
        if (revisionError) throw revisionError;
        return json({clip,variants:variants||[],revisions:revisions||[],video,source});
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
