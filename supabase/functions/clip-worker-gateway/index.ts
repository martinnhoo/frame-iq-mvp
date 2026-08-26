/**
 * clip-worker-gateway — ponte privilegiada entre o worker do Fly e o Supabase.
 *
 * O worker do Fly não tem (e não pode ter) SUPABASE_SERVICE_ROLE_KEY nem
 * GEMINI_API_KEY. Ele só conhece SUPABASE_URL e CLIP_WORKER_SECRET. Toda
 * operação privilegiada — claim de job, contexto, lease, candidatos, autopilot,
 * done/error e signed URLs de storage — acontece aqui dentro, onde as chaves
 * realmente moram. A parte de IA (transcrição e seleção editorial) também roda
 * aqui, com Gemini.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WORKER_SECRET = Deno.env.get("CLIP_WORKER_SECRET") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("CLIP_GEMINI_MODEL") || "gemini-2.5-flash";
const BUCKET = Deno.env.get("CLIP_BUCKET") || "clip-network";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const nowIso = () => new Date().toISOString();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseJsonLoose(text: string) {
  try {
    return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    throw new Error(`IA devolveu resposta não-JSON: ${text.slice(0, 300)}`);
  }
}

/** Mesmo Gemini, servido pelo AI Gateway do Lovable (chave gerenciada). */
async function geminiViaGateway(parts: any[], systemText: string) {
  if (!LOVABLE_API_KEY) throw new Error("Nem GEMINI_API_KEY nem LOVABLE_API_KEY disponíveis");
  const content = parts.map((p) => {
    if (p?.inlineData) {
      return {
        type: "input_audio",
        input_audio: { data: p.inlineData.data, format: (p.inlineData.mimeType || "").includes("wav") ? "wav" : "mp3" },
      };
    }
    return { type: "text", text: p.text || "" };
  });
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GATEWAY_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemText },
        { role: "user", content },
      ],
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`AI Gateway falhou (${res.status}): ${JSON.stringify(body).slice(0, 600)}`);
  return parseJsonLoose(body.choices?.[0]?.message?.content || "{}");
}


 * Gemini. Duas rotas, mesma família de modelo:
 * - GEMINI_API_KEY presente → Google direto.
 * - Caso contrário → AI Gateway do Lovable (LOVABLE_API_KEY, já gerenciada).
 * Assim ninguém precisa copiar chave de IA para o Fly nem criar chave nova.
 */
async function gemini(parts: any[], systemText: string) {
  if (!GEMINI_API_KEY) return await geminiViaGateway(parts, systemText);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
      }),
    },
  );
  const body = await res.json();
  if (!res.ok) throw new Error(`Gemini falhou: ${JSON.stringify(body).slice(0, 600)}`);

  const text = (body.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p.text || "").join("");
  try {
    return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    throw new Error(`Gemini devolveu resposta não-JSON: ${text.slice(0, 300)}`);
  }
}

// Campos que o worker pode escrever. Lista fechada: o worker é uma máquina
// remota, não um cliente confiável para escrever qualquer coluna.
const VIDEO_FIELDS = new Set([
  "pipeline_stage", "media_status", "stage_detail", "duration_seconds", "transcript",
  "transcript_status", "clips_generated", "last_error", "locked_by", "locked_at",
  "lease_expires_at", "next_retry_at", "processing_finished_at", "updated_at",
]);
const CLIP_FIELDS = new Set([
  "render_status", "rendered_storage_path", "rendered_url", "last_error",
  "locked_by", "lease_expires_at", "render_attempts", "status", "updated_at",
]);
const pick = (patch: Record<string, unknown>, allow: Set<string>) =>
  Object.fromEntries(Object.entries(patch || {}).filter(([k]) => allow.has(k)));

async function loadContext(sourceId: string) {
  const { data: source } = await admin.from("clip_sources").select("*").eq("id", sourceId).maybeSingle();
  if (!source) throw new Error("Fonte do vídeo não existe mais");
  const { data: network } = await admin.from("clip_networks").select("*").eq("id", source.network_id).maybeSingle();
  if (!network) throw new Error("Rede do vídeo não existe mais");
  const { data: accounts } = await admin.from("clip_accounts")
    .select("id,label,niche,tone,rules,daily_limit")
    .eq("network_id", network.id).eq("active", true);
  if (!accounts?.length) throw new Error("Nenhuma conta editorial ativa nesta rede");
  return { source, network, accounts };
}

/** Seleção editorial com Gemini. Mesmas regras do orquestrador anterior. */
async function orchestrate(
  network: Record<string, any>,
  accounts: Record<string, any>[],
  transcript: { segments?: { start: number; end: number; text: string }[]; duration?: number },
) {
  const timestamped = (transcript.segments || [])
    .map((s) => `[${Number(s.start).toFixed(1)}-${Number(s.end).toFixed(1)}] ${s.text}`)
    .join("\n").slice(0, 240_000);

  const prompt = [
    `Você é o editor-chefe de uma rede de cortes verticais. Escolha no máximo ${Math.min(12, Number(network.daily_limit) || 10)} cortes realmente bons deste conteúdo.`,
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

  const parsed = await gemini([{ text: prompt }], "Seja seletivo. Qualidade acima de quantidade. Responda apenas JSON.");
  const accountIds = new Set(accounts.map((a) => a.id));
  const seen: any[] = [];
  return (parsed.clips || [])
    .map((c: any) => ({ ...c, start_seconds: Number(c.start_seconds), end_seconds: Number(c.end_seconds), score: Number(c.score) || 0 }))
    .filter((c: any) => accountIds.has(c.account_id))
    .filter((c: any) => Number.isFinite(c.start_seconds) && Number.isFinite(c.end_seconds))
    .filter((c: any) => c.end_seconds - c.start_seconds >= 12 && c.end_seconds - c.start_seconds <= 95)
    .filter((c: any) => c.start_seconds >= 0 && c.end_seconds <= (transcript.duration || Infinity) + 2)
    .sort((a: any, b: any) => b.score - a.score)
    .filter((c: any) => {
      const overlaps = seen.some((s) => s.account_id === c.account_id && c.start_seconds < s.end_seconds - 3 && c.end_seconds > s.start_seconds + 3);
      if (overlaps) return false;
      seen.push(c);
      return true;
    });
}

async function autoApprove(network: Record<string, any>, accounts: Record<string, any>[], clips: any[]) {
  if (network.approval_mode !== "auto") return [];
  const minScore = Number(network.min_score || 0);
  const today = nowIso().slice(0, 10);
  const approved: any[] = [];
  for (const account of accounts) {
    const { count } = await admin.from("clips")
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
      const { error } = await admin.from("clips")
        .update({ status: "approved", updated_at: nowIso() })
        .eq("id", clip.id).eq("status", "candidate");
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
      case "ping":
        return json({ ok: true, gemini: Boolean(GEMINI_API_KEY), bucket: BUCKET });

      case "recover_stuck": {
        const { data, error } = await admin.rpc("clip_recover_stuck_jobs");
        if (error) throw error;
        return json({ recovered: data ?? 0 });
      }

      case "claim": {
        const { data, error } = await admin.rpc("clip_claim_source_video", {
          p_worker_id: payload.worker_id, p_lease_secs: payload.lease_secs,
        });
        if (error) throw error;
        return json({ job: Array.isArray(data) ? data[0] ?? null : data ?? null });
      }

      case "context":
        return json(await loadContext(payload.source_id));

      case "touch_lease": {
        const { error } = await admin.rpc("clip_touch_lease", {
          p_video_id: payload.video_id, p_worker_id: payload.worker_id,
          p_stage: payload.stage, p_detail: payload.detail ?? null,
          p_lease_secs: payload.lease_secs,
        });
        if (error) throw error;
        return json({ ok: true });
      }

      case "update_video": {
        const patch = { ...pick(payload.patch, VIDEO_FIELDS), updated_at: nowIso() };
        const { error } = await admin.from("clip_source_videos").update(patch).eq("id", payload.video_id);
        if (error) throw error;
        return json({ ok: true });
      }

      case "update_clip": {
        const patch = { ...pick(payload.patch, CLIP_FIELDS), updated_at: nowIso() };
        const { error } = await admin.from("clips").update(patch).eq("id", payload.clip_id);
        if (error) throw error;
        return json({ ok: true });
      }

      /** Gemini transcreve um bloco de áudio e devolve segmentos com timestamps. */
      case "transcribe_chunk": {
        const parsed = await gemini(
          [
            { inlineData: { mimeType: payload.mime_type || "audio/mpeg", data: payload.audio_base64 } },
            {
              text: [
                "Transcreva este áudio integralmente no idioma original.",
                "Divida em segmentos curtos (uma frase cada) com timestamps em segundos relativos ao início DESTE áudio.",
                'Responda SOMENTE JSON: {"segments":[{"start":0.0,"end":3.2,"text":"..."}]}',
              ].join("\n"),
            },
          ],
          "Você é um transcritor preciso. Não resuma, não invente, não traduza.",
        );
        const segments = (parsed.segments || [])
          .map((s: any) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || "").trim() }))
          .filter((s: any) => s.text);
        return json({ segments });
      }

      /** Seleciona candidatos, grava (idempotente) e roda o autopilot. */
      case "analyze_and_save": {
        const job = payload.job;
        const transcript = payload.transcript;
        const { network, accounts } = await loadContext(job.source_id);
        const candidates = await orchestrate(network, accounts, transcript);
        if (candidates.length) {
          const rows = candidates.map((c: any) => ({
            user_id: job.user_id,
            source_video_id: job.id,
            clip_account_id: c.account_id,
            dedupe_key: `${c.account_id}:${Math.round(c.start_seconds)}`,
            start_seconds: c.start_seconds,
            end_seconds: c.end_seconds,
            transcript_excerpt: (transcript.segments || [])
              .filter((s: any) => s.end > c.start_seconds && s.start < c.end_seconds)
              .map((s: any) => s.text).join(" ").slice(0, 4000),
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
          const { error } = await admin.from("clips")
            .upsert(rows, { onConflict: "source_video_id,dedupe_key", ignoreDuplicates: true });
          if (error) throw error;
        }
        const { data: clips } = await admin.from("clips").select("*").eq("source_video_id", job.id);
        const approved = await autoApprove(network, accounts, clips || []);
        return json({ clips: clips || [], approved });
      }

      /** Próximo clip aprovado esperando render (modo revisão manual). */
      case "next_render_backlog": {
        const { data: rows, error } = await admin.from("clips")
          .select("*, clip_source_videos(*)")
          .eq("status", "approved").eq("render_status", "pending")
          .not("source_video_id", "is", null)
          .lt("render_attempts", 4)
          .order("score", { ascending: false }).limit(1);
        if (error) throw error;
        const clip = rows?.[0];
        const video = clip?.clip_source_videos;
        if (!clip || !video?.transcript || !video.rights_confirmed) return json({ clip: null });
        const { data: source } = await admin.from("clip_sources").select("*").eq("id", video.source_id).maybeSingle();
        if (!source?.rights_confirmed) return json({ clip: null });
        return json({ clip, video, source });
      }

      /** Storage sem service role no worker: URL assinada de subida/descida. */
      case "signed_upload": {
        const { data, error } = await admin.storage.from(BUCKET)
          .createSignedUploadUrl(payload.path, { upsert: true });
        if (error) throw error;
        return json({ path: payload.path, signed_url: data.signedUrl, token: data.token });
      }

      case "signed_download": {
        const { data, error } = await admin.storage.from(BUCKET)
          .createSignedUrl(payload.path, Number(payload.expires_in || 3600));
        if (error) throw error;
        return json({ signed_url: data.signedUrl });
      }

      case "fail_job": {
        const attempts = Number(payload.attempts || 0);
        const terminal = payload.retryable === false || attempts >= 4;
        const { error } = await admin.from("clip_source_videos").update({
          pipeline_stage: terminal ? "error" : "discovered",
          media_status: terminal ? "error" : "waiting_for_media",
          stage_detail: null,
          last_error: String(payload.error || "").slice(0, 2000),
          locked_by: null, locked_at: null, lease_expires_at: null,
          next_retry_at: terminal ? null : new Date(Date.now() + Math.min(30, attempts * 5 + 2) * 60_000).toISOString(),
          processing_finished_at: terminal ? nowIso() : null,
          updated_at: nowIso(),
        }).eq("id", payload.video_id);
        if (error) throw error;
        return json({ ok: true, terminal });
      }

      case "finish_job": {
        const { error } = await admin.from("clip_source_videos").update({
          pipeline_stage: "done", media_status: "processed", stage_detail: null,
          clips_generated: Number(payload.clips_generated || 0), last_error: null,
          locked_by: null, locked_at: null, lease_expires_at: null,
          processing_finished_at: nowIso(), updated_at: nowIso(),
        }).eq("id", payload.video_id);
        if (error) throw error;
        return json({ ok: true });
      }

      default:
        return json({ error: `ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
