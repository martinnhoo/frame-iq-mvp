import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.CLIP_ORCHESTRATOR_MODEL || "gpt-5-mini";
const POLL_MS = Number(process.env.CLIP_WORKER_POLL_MS || 30000);
const RUN_ONCE = process.env.RUN_ONCE === "1" || process.argv.includes("--once");
if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_API_KEY) throw new Error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or OPENAI_API_KEY");
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function run(bin, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    p.stderr.on("data", d => stderr += d.toString());
    p.on("error", reject);
    p.on("close", code => code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}: ${stderr.slice(-1200)}`)));
  });
}

async function acquireJob() {
  // One small worker is enough for the pilot. This optimistic lock prevents duplicate work in normal operation.
  const { data: jobs, error } = await supabase.from("clip_source_videos")
    .select("*, clip_sources(*, clip_networks(*))")
    .eq("rights_confirmed", true)
    .eq("media_status", "ready")
    .eq("transcript_status", "pending")
    .order("source_published_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const job = jobs?.[0];
  if (!job) return null;
  const { data: locked } = await supabase.from("clip_source_videos")
    .update({ media_status: "processing", transcript_status: "processing", updated_at: new Date().toISOString() })
    .eq("id", job.id).eq("media_status", "ready").eq("transcript_status", "pending")
    .select("id").maybeSingle();
  return locked ? job : null;
}

async function materializeMedia(job, dir) {
  const out = join(dir, "source.mp4");
  let bytes;
  if (job.media_storage_path) {
    const { data, error } = await supabase.storage.from("clip-network").download(job.media_storage_path);
    if (error) throw error;
    bytes = new Uint8Array(await data.arrayBuffer());
  } else if (job.media_url) {
    const res = await fetch(job.media_url);
    if (!res.ok) throw new Error(`media download failed ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  } else {
    throw new Error("Authorized source has no media_url/media_storage_path");
  }
  await writeFile(out, bytes);
  return out;
}

async function transcribe(input, dir) {
  const audioDir = join(dir, "audio");
  await mkdir(audioDir, { recursive: true });
  // 15-minute mono chunks keep every request comfortably under Whisper file limits.
  await run("ffmpeg", ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", "-f", "segment", "-segment_time", "900", "-reset_timestamps", "1", join(audioDir, "chunk_%03d.mp3")]);
  const files = (await readdir(audioDir)).filter(x => x.endsWith(".mp3")).sort();
  let offset = 0;
  const segments = [];
  const texts = [];
  for (const file of files) {
    const buf = await readFile(join(audioDir, file));
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: "audio/mpeg" }), file);
    fd.append("model", "whisper-1");
    fd.append("response_format", "verbose_json");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: fd });
    const body = await res.json();
    if (!res.ok) throw new Error(`Whisper failed: ${JSON.stringify(body).slice(0,500)}`);
    texts.push(body.text || "");
    for (const seg of body.segments || []) segments.push({ start: Number(seg.start || 0) + offset, end: Number(seg.end || 0) + offset, text: String(seg.text || "").trim() });
    offset += Number(body.duration || 900);
  }
  return { text: texts.join(" ").trim(), segments, duration: segments.at(-1)?.end || offset };
}

async function orchestrate(job, transcript) {
  const network = job.clip_sources.clip_networks;
  const { data: accounts, error } = await supabase.from("clip_accounts").select("id,label,niche,tone,rules,daily_limit").eq("network_id", network.id).eq("active", true);
  if (error) throw error;
  if (!accounts?.length) throw new Error("No active clip accounts");

  const timestamped = transcript.segments.map(s => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join("\n");
  const prompt = `Você é o editor-chefe de uma rede de cortes verticais. Escolha no máximo ${Math.min(15, network.daily_limit || 10)} cortes realmente bons deste conteúdo.\n\nCONTAS DISPONÍVEIS:\n${accounts.map(a => `- id=${a.id} | ${a.label} | nicho=${a.niche} | tom=${a.tone || 'natural'} | regras=${JSON.stringify(a.rules || {})}`).join("\n")}\n\nREGRAS:\n- Cada corte deve funcionar sozinho, sem depender de contexto externo.\n- Duração ideal 25-65s; aceite até 90s só se o payoff exigir.\n- Comece perto de uma frase/hook forte e termine no payoff.\n- Evite cortes repetidos ou sobrepostos.\n- Distribua apenas para a conta cujo nicho realmente combina.\n- Score 0-100 deve refletir chance de retenção/compartilhamento, não preencher cota.\n- Caption em português natural, curta, sem inventar fatos.\n- on_screen_title deve ter no máximo 9 palavras.\n\nTRANSCRIÇÃO COM TIMESTAMPS:\n${timestamped}\n\nResponda SOMENTE JSON: {"clips":[{"account_id":"uuid","start_seconds":0,"end_seconds":40,"topic":"","hook":"","on_screen_title":"","caption":"","score":85,"reason":""}]}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Seja seletivo. Qualidade > quantidade." }, { role: "user", content: prompt }] }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Orchestrator failed: ${JSON.stringify(body).slice(0,800)}`);
  const parsed = JSON.parse(body.choices?.[0]?.message?.content || '{"clips":[]}');
  const accountIds = new Set(accounts.map(a => a.id));
  const candidates = (parsed.clips || []).filter(c => accountIds.has(c.account_id) && Number(c.end_seconds) > Number(c.start_seconds) + 10);
  return { network, accounts, candidates };
}

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000), x = ms % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(x).padStart(3,'0')}`;
}

async function writeSrt(transcript, start, end, file) {
  const rows = transcript.segments.filter(s => s.end > start && s.start < end).map((s, i) => `${i+1}\n${srtTime(Math.max(0,s.start-start))} --> ${srtTime(Math.min(end-start,s.end-start))}\n${s.text}\n`).join("\n");
  await writeFile(file, rows || `1\n00:00:00,000 --> 00:00:03,000\n \n`);
}

async function renderClip(sourceFile, clip, transcript, dir) {
  const out = join(dir, `${clip.id}.mp4`);
  const srt = join(dir, `${clip.id}.srt`);
  await writeSrt(transcript, Number(clip.start_seconds), Number(clip.end_seconds), srt);
  const duration = Number(clip.end_seconds) - Number(clip.start_seconds);
  const escapedSrt = srt.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
  const filter = `[0:v]split=2[bg0][fg0];[bg0]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2[bg];[fg0]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,subtitles='${escapedSrt}':force_style='FontName=Arial,FontSize=18,Bold=1,Outline=2,Shadow=0,Alignment=2,MarginV=115'[v]`;
  await run("ffmpeg", ["-y", "-ss", String(clip.start_seconds), "-i", sourceFile, "-t", String(duration), "-filter_complex", filter, "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out]);
  return out;
}

async function nextScheduleSlots(network, count, accountId) {
  const zone = network.timezone || "America/Sao_Paulo";
  const slots = network.posting_slots?.length ? network.posting_slots : ["09:00","10:30","12:00","13:30","15:00","16:30","18:00","19:30","21:00","22:30"];
  const { data: existing } = await supabase.from("clip_publications").select("scheduled_at,clips!inner(clip_account_id)").eq("clips.clip_account_id", accountId).gte("scheduled_at", DateTime.now().setZone(zone).startOf("day").toUTC().toISO());
  const occupied = new Set((existing || []).map(x => DateTime.fromISO(x.scheduled_at).setZone(zone).toFormat("yyyy-LL-dd HH:mm")));
  const result = [];
  let day = DateTime.now().setZone(zone).startOf("day");
  while (result.length < count) {
    for (const slot of slots) {
      const [hh, mm] = slot.split(":").map(Number);
      const dt = day.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
      if (dt < DateTime.now().setZone(zone).plus({ minutes: 10 })) continue;
      const key = dt.toFormat("yyyy-LL-dd HH:mm");
      if (!occupied.has(key)) { result.push(dt.toUTC().toISO()); occupied.add(key); }
      if (result.length >= count) break;
    }
    day = day.plus({ days: 1 });
  }
  return result;
}

async function saveCandidates(job, transcript, sourceFile, orchestration, dir) {
  const { network, candidates } = orchestration;
  const rows = candidates.map(c => ({
    user_id: job.user_id, source_video_id: job.id, clip_account_id: c.account_id,
    start_seconds: Number(c.start_seconds), end_seconds: Number(c.end_seconds),
    transcript_excerpt: transcript.segments.filter(s => s.end > c.start_seconds && s.start < c.end_seconds).map(s => s.text).join(" ").slice(0,5000),
    topic: c.topic || null, hook: c.hook || null, on_screen_title: c.on_screen_title || null,
    caption: c.caption || "", score: Math.max(0, Math.min(100, Number(c.score || 0))), ai_reason: c.reason || null,
    status: network.approval_mode === "auto" && Number(c.score || 0) >= Number(network.min_score || 78) ? "approved" : "candidate",
    render_status: "pending",
  }));
  if (!rows.length) return [];
  const { data: clips, error } = await supabase.from("clips").insert(rows).select("*");
  if (error) throw error;

  const approved = clips.filter(c => c.status === "approved").slice(0, network.daily_limit || 10);
  const byAccount = new Map();
  for (const c of approved) byAccount.set(c.clip_account_id, [...(byAccount.get(c.clip_account_id) || []), c]);

  for (const [accountId, accountClips] of byAccount.entries()) {
    const slots = await nextScheduleSlots(network, accountClips.length, accountId);
    const { data: socials } = await supabase.from("clip_social_accounts").select("id,platform,status").eq("clip_account_id", accountId).eq("status", "active");
    const instagram = (socials || []).find(x => x.platform === "instagram");
    for (let i = 0; i < accountClips.length; i++) {
      const clip = accountClips[i];
      try {
        await supabase.from("clips").update({ render_status: "rendering", updated_at: new Date().toISOString() }).eq("id", clip.id);
        const rendered = await renderClip(sourceFile, clip, transcript, dir);
        const bytes = await readFile(rendered);
        const storagePath = `${job.user_id}/${clip.id}.mp4`;
        const { error: uploadError } = await supabase.storage.from("clip-network").upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from("clip-network").getPublicUrl(storagePath);
        const renderedUrl = publicData.publicUrl;
        await supabase.from("clips").update({ render_status: "ready", rendered_storage_path: storagePath, rendered_url: renderedUrl, scheduled_at: slots[i], status: instagram ? "scheduled" : "approved", updated_at: new Date().toISOString() }).eq("id", clip.id);
        if (instagram) {
          await supabase.from("clip_publications").upsert({ user_id: job.user_id, clip_id: clip.id, social_account_id: instagram.id, platform: "instagram", status: "queued", scheduled_at: slots[i], updated_at: new Date().toISOString() }, { onConflict: "clip_id,social_account_id" });
        }
      } catch (e) {
        await supabase.from("clips").update({ render_status: "error", status: "error", ai_reason: `${clip.ai_reason || ''}\nRender error: ${String(e)}`.trim(), updated_at: new Date().toISOString() }).eq("id", clip.id);
      }
    }
  }
  return clips;
}

async function processJob(job) {
  const dir = await mkdtemp(join(tmpdir(), "adbrief-clips-"));
  try {
    const sourceFile = await materializeMedia(job, dir);
    const transcript = await transcribe(sourceFile, dir);
    await supabase.from("clip_source_videos").update({ transcript_status: "ready", transcript, duration_seconds: transcript.duration, updated_at: new Date().toISOString() }).eq("id", job.id);
    const orchestration = await orchestrate(job, transcript);
    const clips = await saveCandidates(job, transcript, sourceFile, orchestration, dir);
    await supabase.from("clip_source_videos").update({ media_status: "processed", last_error: null, updated_at: new Date().toISOString() }).eq("id", job.id);
    console.log(`[clip-worker] ${job.title}: ${clips.length} candidates`);
  } catch (e) {
    console.error("[clip-worker] job failed", job.id, e);
    await supabase.from("clip_source_videos").update({ media_status: "error", transcript_status: "error", last_error: String(e).slice(0,2000), updated_at: new Date().toISOString() }).eq("id", job.id);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}


async function processApprovedBacklog() {
  const { data: rows, error } = await supabase.from("clips")
    .select("*, clip_accounts(*, clip_networks(*)), clip_source_videos(*)")
    .eq("status", "approved").eq("render_status", "pending")
    .not("source_video_id", "is", null)
    .order("score", { ascending: false }).limit(1);
  if (error) throw error;
  const clip = rows?.[0];
  if (!clip?.clip_source_videos?.transcript) return false;
  const job = clip.clip_source_videos;
  if (!job.rights_confirmed || (!job.media_url && !job.media_storage_path)) return false;
  const dir = await mkdtemp(join(tmpdir(), "adbrief-approved-"));
  try {
    const sourceFile = await materializeMedia(job, dir);
    await supabase.from("clips").update({ render_status: "rendering", updated_at: new Date().toISOString() }).eq("id", clip.id);
    const rendered = await renderClip(sourceFile, clip, job.transcript, dir);
    const bytes = await readFile(rendered);
    const storagePath = `${clip.user_id}/${clip.id}.mp4`;
    const { error: uploadError } = await supabase.storage.from("clip-network").upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
    if (uploadError) throw uploadError;
    const { data: publicData } = supabase.storage.from("clip-network").getPublicUrl(storagePath);
    const network = clip.clip_accounts.clip_networks;
    const [slot] = await nextScheduleSlots(network, 1, clip.clip_account_id);
    const { data: socials } = await supabase.from("clip_social_accounts").select("id,platform,status").eq("clip_account_id", clip.clip_account_id).eq("status", "active");
    const instagram = (socials || []).find(x => x.platform === "instagram");
    await supabase.from("clips").update({ render_status: "ready", rendered_storage_path: storagePath, rendered_url: publicData.publicUrl, scheduled_at: slot, status: instagram ? "scheduled" : "approved", updated_at: new Date().toISOString() }).eq("id", clip.id);
    if (instagram) await supabase.from("clip_publications").upsert({ user_id: clip.user_id, clip_id: clip.id, social_account_id: instagram.id, platform: "instagram", status: "queued", scheduled_at: slot, updated_at: new Date().toISOString() }, { onConflict: "clip_id,social_account_id" });
    return true;
  } catch (e) {
    await supabase.from("clips").update({ render_status: "error", status: "error", ai_reason: `${clip.ai_reason || ''}\nRender error: ${String(e)}`.trim(), updated_at: new Date().toISOString() }).eq("id", clip.id);
    return true;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

async function loop() {
  do {
    try {
      const backlog = await processApprovedBacklog();
      if (backlog) { if (RUN_ONCE) break; }
      else {
        const job = await acquireJob();
        if (job) await processJob(job);
        else if (RUN_ONCE) break;
      }
    } catch (e) { console.error("[clip-worker] loop error", e); }
    if (RUN_ONCE) break;
    await new Promise(r => setTimeout(r, POLL_MS));
  } while (true);
}

await loop();
