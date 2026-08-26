/**
 * AdBrief Clip Network — worker da máquina de cortes.
 *
 * Um vídeo por vez, do começo ao fim, sem clique humano:
 *
 *   descoberto → baixando → transcrevendo → analisando → renderizando → concluído
 *
 * Regras que o código respeita e que não são negociáveis:
 * - Só processa vídeo cuja FONTE está marcada como autorizada (rights_confirmed).
 * - O master vive apenas no filesystem temporário do worker e é apagado no fim.
 * - Nada é publicado em rede social aqui. Autopilot nesta fase significa
 *   "deixar os cortes prontos sozinho".
 * - O bucket é privado: o worker grava o caminho, não uma URL pública.
 * - Idempotência: candidato tem dedupe_key, vídeo concluído não volta para a
 *   fila, e o lock com lease permite recuperar job abandonado.
 */
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { hostname } from "node:os";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveMedia, probeDuration, MediaResolverError } from "./mediaResolver.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.CLIP_ORCHESTRATOR_MODEL || "gpt-4o-mini";
const BUCKET = process.env.CLIP_BUCKET || "clip-network";
const POLL_MS = Number(process.env.CLIP_WORKER_POLL_MS || 30000);
const LEASE_SECS = Number(process.env.CLIP_LEASE_SECONDS || 900);
const TMP_ROOT = process.env.CLIP_TMP_DIR || "/data/tmp";
const WORKER_ID = process.env.CLIP_WORKER_ID || `clip-worker-${hostname()}`;
const RUN_ONCE = process.env.RUN_ONCE === "1" || process.argv.includes("--once");

if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_API_KEY) {
  throw new Error("Faltam SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou OPENAI_API_KEY");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const log = (...a) => console.log(`[clip-worker ${new Date().toISOString()}]`, ...a);
const nowIso = () => new Date().toISOString();

let shuttingDown = false;
process.on("SIGTERM", () => { shuttingDown = true; log("SIGTERM: encerrando após o job atual"); });
process.on("SIGINT", () => { shuttingDown = true; });

function run(bin, args, { timeoutMs = 45 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`${bin} excedeu o tempo limite`)); }, timeoutMs);
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`${bin} saiu com ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

// ── Estado do pipeline ───────────────────────────────────────────────────────

async function setStage(videoId, stage, detail) {
  await supabase.rpc("clip_touch_lease", {
    p_video_id: videoId, p_worker_id: WORKER_ID,
    p_stage: stage, p_detail: detail ?? null, p_lease_secs: LEASE_SECS,
  });
}

/** Heartbeat: renova o lease a 1/3 do tempo para o reaper não roubar o job em curso. */
function startHeartbeat(videoId, getStage) {
  const interval = setInterval(() => {
    supabase.rpc("clip_touch_lease", {
      p_video_id: videoId, p_worker_id: WORKER_ID,
      p_stage: getStage(), p_detail: null, p_lease_secs: LEASE_SECS,
    }).then(() => {}, (e) => log("heartbeat falhou", e?.message));
  }, Math.max(30_000, Math.floor(LEASE_SECS * 1000 / 3)));
  return () => clearInterval(interval);
}

async function claimJob() {
  const { data, error } = await supabase.rpc("clip_claim_source_video", {
    p_worker_id: WORKER_ID, p_lease_secs: LEASE_SECS,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

async function loadContext(job) {
  const { data: source, error } = await supabase
    .from("clip_sources").select("*").eq("id", job.source_id).maybeSingle();
  if (error) throw error;
  if (!source) throw new Error("Fonte do vídeo não existe mais");
  const { data: network } = await supabase
    .from("clip_networks").select("*").eq("id", source.network_id).maybeSingle();
  if (!network) throw new Error("Rede do vídeo não existe mais");
  const { data: accounts } = await supabase
    .from("clip_accounts").select("id,label,niche,tone,rules,daily_limit")
    .eq("network_id", network.id).eq("active", true);
  if (!accounts?.length) throw new Error("Nenhuma conta editorial ativa nesta rede");
  return { source, network, accounts };
}

// ── Transcrição ──────────────────────────────────────────────────────────────

async function transcribe(input, dir) {
  const audioDir = join(dir, "audio");
  await mkdir(audioDir, { recursive: true });
  // Blocos de 15 min em mono mantêm cada requisição confortavelmente abaixo do
  // limite de arquivo do Whisper, mesmo em vídeo de 3 horas.
  await run("ffmpeg", ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k",
    "-f", "segment", "-segment_time", "900", "-reset_timestamps", "1", join(audioDir, "chunk_%03d.mp3")]);
  const files = (await readdir(audioDir)).filter((x) => x.endsWith(".mp3")).sort();
  if (!files.length) throw new Error("Nenhum áudio extraído do master");

  let offset = 0;
  const segments = [];
  const texts = [];
  for (const file of files) {
    const buf = await readFile(join(audioDir, file));
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: "audio/mpeg" }), file);
    fd.append("model", "whisper-1");
    fd.append("response_format", "verbose_json");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: fd,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Whisper falhou: ${JSON.stringify(body).slice(0, 500)}`);
    texts.push(body.text || "");
    for (const seg of body.segments || []) {
      segments.push({
        start: Number(seg.start || 0) + offset,
        end: Number(seg.end || 0) + offset,
        text: String(seg.text || "").trim(),
      });
    }
    offset += Number(body.duration || 900);
  }
  return { text: texts.join(" ").trim(), segments, duration: segments.at(-1)?.end || offset };
}

// ── Seleção editorial ────────────────────────────────────────────────────────

async function orchestrate({ network, accounts }, transcript) {
  const timestamped = transcript.segments
    .map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join("\n")
    .slice(0, 240_000);

  const prompt = [
    `Você é o editor-chefe de uma rede de cortes verticais. Escolha no máximo ${Math.min(12, network.daily_limit || 10)} cortes realmente bons deste conteúdo.`,
    "",
    "CONTAS EDITORIAIS DISPONÍVEIS:",
    ...accounts.map((a) => `- id=${a.id} | ${a.label} | nicho=${a.niche} | tom=${a.tone || "natural"} | regras=${JSON.stringify(a.rules || {})}`),
    "",
    "REGRAS:",
    "- Cada corte deve funcionar sozinho, sem depender de contexto externo.",
    "- Duração entre 25 e 65 segundos. Só passe de 65s se o payoff exigir, nunca acima de 90s.",
    "- Comece perto de uma frase/hook forte e termine no payoff.",
    "- Nunca devolva cortes sobrepostos ou repetidos.",
    "- Roteie cada corte para a ÚNICA conta cujo nicho e tom realmente combinam. Se nenhuma combina, não crie o corte.",
    "- Score 0-100 reflete chance real de retenção e compartilhamento — não sirva para preencher cota.",
    "- Caption em português natural e curta, sem inventar fatos.",
    "- on_screen_title com no máximo 9 palavras.",
    "",
    "TRANSCRIÇÃO COM TIMESTAMPS:",
    timestamped,
    "",
    'Responda SOMENTE JSON: {"clips":[{"account_id":"uuid","start_seconds":0,"end_seconds":40,"topic":"","hook":"","on_screen_title":"","caption":"","score":85,"reason":""}]}',
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Seja seletivo. Qualidade acima de quantidade." },
        { role: "user", content: prompt },
      ],
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Orquestrador falhou: ${JSON.stringify(body).slice(0, 800)}`);
  const parsed = JSON.parse(body.choices?.[0]?.message?.content || '{"clips":[]}');
  const accountIds = new Set(accounts.map((a) => a.id));

  const seen = [];
  return (parsed.clips || [])
    .map((c) => ({ ...c, start_seconds: Number(c.start_seconds), end_seconds: Number(c.end_seconds), score: Number(c.score) || 0 }))
    .filter((c) => accountIds.has(c.account_id))
    .filter((c) => Number.isFinite(c.start_seconds) && Number.isFinite(c.end_seconds))
    .filter((c) => c.end_seconds - c.start_seconds >= 12 && c.end_seconds - c.start_seconds <= 95)
    .filter((c) => c.start_seconds >= 0 && c.end_seconds <= (transcript.duration || Infinity) + 2)
    .sort((a, b) => b.score - a.score)
    // Sobreposição na mesma conta é corte duplicado com outro nome.
    .filter((c) => {
      const overlaps = seen.some((s) => s.account_id === c.account_id && c.start_seconds < s.end_seconds - 3 && c.end_seconds > s.start_seconds + 3);
      if (overlaps) return false;
      seen.push(c);
      return true;
    });
}

const dedupeKey = (c) => `${c.account_id}:${Math.round(c.start_seconds)}`;

async function saveCandidates(job, transcript, candidates) {
  if (!candidates.length) return [];
  const rows = candidates.map((c) => ({
    user_id: job.user_id,
    source_video_id: job.id,
    clip_account_id: c.account_id,
    dedupe_key: dedupeKey(c),
    start_seconds: c.start_seconds,
    end_seconds: c.end_seconds,
    transcript_excerpt: transcript.segments
      .filter((s) => s.end > c.start_seconds && s.start < c.end_seconds)
      .map((s) => s.text).join(" ").slice(0, 4000),
    topic: c.topic || null,
    hook: c.hook || null,
    on_screen_title: c.on_screen_title || null,
    caption: c.caption || null,
    score: Math.max(0, Math.min(100, c.score)),
    ai_reason: c.reason || null,
    status: "candidate",
    render_status: "pending",
    updated_at: nowIso(),
  }));
  // ignoreDuplicates: um retry não deve sobrescrever decisão humana já tomada
  // sobre um candidato que existe (aprovado/rejeitado).
  const { error } = await supabase.from("clips")
    .upsert(rows, { onConflict: "source_video_id,dedupe_key", ignoreDuplicates: true });
  if (error) throw error;
  const { data } = await supabase.from("clips").select("*").eq("source_video_id", job.id);
  return data || [];
}

// ── Autopilot: aprova sozinho, nunca publica ─────────────────────────────────

async function autoApprove({ network, accounts }, clips) {
  if (network.approval_mode !== "auto") return [];
  const minScore = Number(network.min_score || 0);
  const today = nowIso().slice(0, 10);
  const approved = [];

  for (const account of accounts) {
    const { count } = await supabase.from("clips")
      .select("id", { count: "exact", head: true })
      .eq("clip_account_id", account.id)
      .in("status", ["approved", "scheduled", "published"])
      .gte("created_at", `${today}T00:00:00.000Z`);
    const cap = Math.min(Number(account.daily_limit || 10), Number(network.daily_limit || 10));
    let room = Math.max(0, cap - (count || 0));
    if (!room) continue;

    const eligible = clips
      .filter((c) => c.clip_account_id === account.id && c.status === "candidate" && Number(c.score) >= minScore)
      .sort((a, b) => Number(b.score) - Number(a.score));
    for (const clip of eligible) {
      if (room <= 0) break;
      const { error } = await supabase.from("clips")
        .update({ status: "approved", updated_at: nowIso() })
        .eq("id", clip.id).eq("status", "candidate");
      if (!error) { approved.push({ ...clip, status: "approved" }); room -= 1; }
    }
  }
  return approved;
}

// ── Render ───────────────────────────────────────────────────────────────────

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), x = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(x).padStart(3, "0")}`;
}

async function writeSrt(transcript, start, end, file) {
  const rows = (transcript?.segments || [])
    .filter((s) => s.end > start && s.start < end)
    .map((s, i) => `${i + 1}\n${srtTime(Math.max(0, s.start - start))} --> ${srtTime(Math.min(end - start, s.end - start))}\n${s.text}\n`)
    .join("\n");
  await writeFile(file, rows || "1\n00:00:00,000 --> 00:00:03,000\n \n");
}

async function renderClip(master, clip, transcript, dir) {
  const out = join(dir, `${clip.id}.mp4`);
  const srt = join(dir, `${clip.id}.srt`);
  const start = Number(clip.start_seconds);
  const duration = Number(clip.end_seconds) - start;
  await writeSrt(transcript, start, Number(clip.end_seconds), srt);
  const escapedSrt = srt.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
  const filter = `[0:v]split=2[bg0][fg0];[bg0]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2[bg];[fg0]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,subtitles='${escapedSrt}':force_style='FontName=DejaVu Sans,FontSize=18,Bold=1,Outline=2,Shadow=0,Alignment=2,MarginV=115'[v]`;
  await run("ffmpeg", ["-y", "-ss", String(start), "-i", master, "-t", String(duration),
    "-filter_complex", filter, "-map", "[v]", "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out]);
  return out;
}

/**
 * Renderiza e sobe. O bucket é privado de propósito: gravamos apenas o caminho
 * e o dashboard pede uma signed URL na hora de assistir/baixar. Persistir uma
 * URL assinada no banco criaria um link que expira e vira erro silencioso.
 */
async function renderAndUpload(master, clip, transcript, dir) {
  await supabase.from("clips").update({
    render_status: "rendering", locked_by: WORKER_ID,
    lease_expires_at: new Date(Date.now() + LEASE_SECS * 1000).toISOString(),
    render_attempts: Number(clip.render_attempts || 0) + 1,
    updated_at: nowIso(),
  }).eq("id", clip.id);
  try {
    const rendered = await renderClip(master, clip, transcript, dir);
    const bytes = await readFile(rendered);
    const path = `${clip.user_id}/${clip.id}.mp4`;
    const { error: upErr } = await supabase.storage.from(BUCKET)
      .upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (upErr) throw upErr;
    await supabase.from("clips").update({
      render_status: "ready", rendered_storage_path: path, rendered_url: null,
      last_error: null, locked_by: null, lease_expires_at: null, updated_at: nowIso(),
    }).eq("id", clip.id);
    await rm(rendered, { force: true });
    return true;
  } catch (e) {
    await supabase.from("clips").update({
      render_status: "error", last_error: String(e?.message || e).slice(0, 1500),
      locked_by: null, lease_expires_at: null, updated_at: nowIso(),
    }).eq("id", clip.id);
    log("render falhou", clip.id, e?.message || e);
    return false;
  }
}

// ── Job completo ─────────────────────────────────────────────────────────────

async function failJob(job, error) {
  const retryable = !(error instanceof MediaResolverError) || error.retryable !== false;
  const attempts = Number(job.attempts || 0);
  const terminal = !retryable || attempts >= 4;
  await supabase.from("clip_source_videos").update({
    pipeline_stage: terminal ? "error" : "discovered",
    media_status: terminal ? "error" : "waiting_for_media",
    stage_detail: null,
    last_error: String(error?.message || error).slice(0, 2000),
    locked_by: null, locked_at: null, lease_expires_at: null,
    next_retry_at: terminal ? null : new Date(Date.now() + Math.min(30, attempts * 5 + 2) * 60_000).toISOString(),
    processing_finished_at: terminal ? nowIso() : null,
    updated_at: nowIso(),
  }).eq("id", job.id);
  log("job falhou", job.id, error?.message || error);
}

async function processJob(job) {
  let stage = "downloading";
  const stopHeartbeat = startHeartbeat(job.id, () => stage);
  await mkdir(TMP_ROOT, { recursive: true });
  const dir = await mkdtemp(join(TMP_ROOT, "clip-"));
  try {
    const ctx = await loadContext(job);

    // 1. Mídia
    const { path: master, strategy } = await resolveMedia({
      video: job, source: ctx.source, dir, supabase, bucket: BUCKET,
      onProgress: (detail) => setStage(job.id, "downloading", detail),
    });
    const duration = await probeDuration(master);
    await supabase.from("clip_source_videos").update({
      media_status: "processing", duration_seconds: duration,
      stage_detail: `master obtido via ${strategy}`, updated_at: nowIso(),
    }).eq("id", job.id);

    // 2. Transcrição — reaproveitada se já existe (retry não repaga o Whisper).
    stage = "transcribing";
    let transcript = job.transcript;
    if (!transcript?.segments?.length) {
      await setStage(job.id, "transcribing", "transcrevendo áudio");
      transcript = await transcribe(master, dir);
      await supabase.from("clip_source_videos").update({
        transcript, transcript_status: "ready",
        duration_seconds: duration || transcript.duration, updated_at: nowIso(),
      }).eq("id", job.id);
    }

    // 3. Seleção editorial
    stage = "analyzing";
    await setStage(job.id, "analyzing", "IA escolhendo os melhores momentos");
    const candidates = await orchestrate(ctx, transcript);
    const clips = await saveCandidates(job, transcript, candidates);

    // 4. Autopilot aprova; nada é publicado.
    const approved = await autoApprove(ctx, clips);

    // 5. Render dos aprovados, usando o master que já está em disco.
    const toRender = (approved.length ? approved : clips.filter((c) => c.status === "approved"))
      .filter((c) => c.render_status === "pending" || c.render_status === "error");
    stage = "rendering";
    let rendered = 0;
    for (const [i, clip] of toRender.entries()) {
      if (shuttingDown) break;
      await setStage(job.id, "rendering", `renderizando ${i + 1}/${toRender.length}`);
      if (await renderAndUpload(master, clip, transcript, dir)) rendered += 1;
    }

    await supabase.from("clip_source_videos").update({
      pipeline_stage: "done", media_status: "processed", stage_detail: null,
      clips_generated: clips.length, last_error: null,
      locked_by: null, locked_at: null, lease_expires_at: null,
      processing_finished_at: nowIso(), updated_at: nowIso(),
    }).eq("id", job.id);
    log(`concluído "${job.title}": ${clips.length} candidatos, ${rendered} renderizados`);
  } catch (e) {
    await failJob(job, e);
  } finally {
    stopHeartbeat();
    // O master nunca sobrevive ao job.
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Backlog de aprovação manual (modo revisão). Precisa reobter o master, então
 * roda só quando não há vídeo novo na fila.
 */
async function processApprovedBacklog() {
  const { data: rows, error } = await supabase.from("clips")
    .select("*, clip_source_videos(*)")
    .eq("status", "approved").eq("render_status", "pending")
    .not("source_video_id", "is", null)
    .lt("render_attempts", 4)
    .order("score", { ascending: false }).limit(1);
  if (error) throw error;
  const clip = rows?.[0];
  const video = clip?.clip_source_videos;
  if (!clip || !video?.transcript || !video.rights_confirmed) return false;

  const { data: source } = await supabase.from("clip_sources").select("*").eq("id", video.source_id).maybeSingle();
  if (!source?.rights_confirmed) return false;

  await mkdir(TMP_ROOT, { recursive: true });
  const dir = await mkdtemp(join(TMP_ROOT, "clip-render-"));
  try {
    const { path: master } = await resolveMedia({ video, source, dir, supabase, bucket: BUCKET });
    await renderAndUpload(master, clip, video.transcript, dir);
    return true;
  } catch (e) {
    await supabase.from("clips").update({
      render_status: "error", last_error: String(e?.message || e).slice(0, 1500), updated_at: nowIso(),
    }).eq("id", clip.id);
    return true;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function loop() {
  do {
    try {
      const { data: recovered } = await supabase.rpc("clip_recover_stuck_jobs");
      if (recovered) log(`recuperados ${recovered} job(s) abandonados`);

      const job = await claimJob();
      if (job) await processJob(job);
      else if (!(await processApprovedBacklog()) && RUN_ONCE) break;
    } catch (e) {
      log("erro no laço", e?.message || e);
    }
    if (RUN_ONCE || shuttingDown) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  } while (true);
  log("worker encerrado");
}

log(`worker ${WORKER_ID} iniciado (modelo ${MODEL}, bucket ${BUCKET})`);
await loop();
