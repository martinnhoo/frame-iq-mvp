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
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("CLIP_GEMINI_MODEL") || "gemini-2.5-flash";
const GATEWAY_MODEL = Deno.env.get("CLIP_GATEWAY_MODEL") || "google/gemini-2.5-flash";

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

/* ---------------------------------------------------------------------------
 * Robustez de IA: 503/429 do Gemini são frequentes e temporários. Em vez de
 * derrubar o job, o gateway absorve o erro com retry (backoff + jitter) e,
 * se preciso, cai para outro modelo e depois para o AI Gateway do Lovable.
 * ------------------------------------------------------------------------- */
const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 5;

class TransientAiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffDelay(attempt: number) {
  const base = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

/** Executa uma rota de IA com retry apenas para erros transitórios. */
async function withRetry<T>(label: string, fn: () => Promise<T>, tried: string[]): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (!(e instanceof TransientAiError)) {
        tried.push(`${label}: erro permanente`);
        throw e;
      }
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(backoffDelay(attempt));
    }
  }
  const status = lastError instanceof TransientAiError ? lastError.status : "?";
  tried.push(`${label}: ${MAX_ATTEMPTS} tentativas, último status ${status}`);
  throw lastError;
}

/** Mesmo Gemini, servido pelo AI Gateway do Lovable (chave gerenciada). */
async function geminiViaGatewayOnce(parts: any[], systemText: string, model: string) {
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
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemText },
        { role: "user", content },
      ],
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    const msg = `AI Gateway falhou (${res.status}): ${raw.slice(0, 300)}`;
    if (TRANSIENT_STATUS.has(res.status)) throw new TransientAiError(msg, res.status);
    throw new Error(msg);
  }
  let body: any;
  try { body = JSON.parse(raw); } catch { throw new Error(`AI Gateway devolveu resposta não-JSON: ${raw.slice(0, 300)}`); }
  return parseJsonLoose(body.choices?.[0]?.message?.content || "{}");
}

async function geminiDirectOnce(parts: any[], systemText: string, model: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
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
  const raw = await res.text();
  if (!res.ok) {
    const msg = `Gemini (${model}) falhou (${res.status}): ${raw.slice(0, 300)}`;
    if (TRANSIENT_STATUS.has(res.status)) throw new TransientAiError(msg, res.status);
    throw new Error(msg);
  }
  let body: any;
  try { body = JSON.parse(raw); } catch { throw new Error(`Gemini devolveu resposta não-JSON: ${raw.slice(0, 300)}`); }
  const text = (body.candidates?.[0]?.content?.parts || [])
    .map((p: { text?: string }) => p.text || "").join("");
  return parseJsonLoose(text);
}

/**
 * Gemini com rotas em cascata:
 * 1. Google direto (GEMINI_MODEL) — se GEMINI_API_KEY existir.
 * 2. Google direto com modelos de fallback (ex.: flash-lite na transcrição).
 * 3. AI Gateway do Lovable.
 * Cada rota tem retry com backoff + jitter; só erros transitórios avançam.
 */
async function gemini(parts: any[], systemText: string, opts: { fallbackModels?: string[] } = {}) {
  const tried: string[] = [];
  let lastError: unknown;

  if (GEMINI_API_KEY) {
    const models = [GEMINI_MODEL, ...(opts.fallbackModels || []).filter((m) => m !== GEMINI_MODEL)];
    for (const model of models) {
      try {
        return await withRetry(`google:${model}`, () => geminiDirectOnce(parts, systemText, model), tried);
      } catch (e) {
        lastError = e;
        if (!(e instanceof TransientAiError)) break;
      }
    }
  }

  const canFallbackToGateway = Boolean(LOVABLE_API_KEY) &&
    (!GEMINI_API_KEY || lastError instanceof TransientAiError);

  if (canFallbackToGateway) {
    try {
      return await withRetry("lovable-gateway", () => geminiViaGatewayOnce(parts, systemText, GATEWAY_MODEL), tried);
    } catch (e) {
      lastError = e;
    }
  }

  if (!lastError) throw new Error("Nem GEMINI_API_KEY nem LOVABLE_API_KEY disponíveis");
  const detail = tried.length ? ` [rotas tentadas: ${tried.join(" | ")}]` : "";
  throw new Error(`${String((lastError as Error)?.message || lastError)}${detail}`);
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
    `Você e um Creative Strategist especializado em short-form e editor-chefe de uma rede de cortes verticais. Escolha no máximo ${Math.min(12, Number(network.daily_limit) || 10)} cortes realmente bons deste conteúdo.`,
    "",
    "CONTAS EDITORIAIS DISPONÍVEIS:",
    ...accounts.map((a) => `- id=${a.id} | ${a.label} | nicho=${a.niche} | tom=${a.tone || "natural"} | regras=${JSON.stringify(a.rules || {})}`),
    "",
    "REGRAS:",
    "- Pense como Creative Strategist, nao como resumidor. Procure momentos que fazem alguem parar o scroll.",
    "- Os PRIMEIROS 1-3 SEGUNDOS sao o criterio mais importante.",
    "- O inicio precisa ter uma fala real que gere curiosidade, conflito, surpresa, opiniao forte, pergunta, revelacao, tensao, reacao ou punchline.",
    "- Nao comece com saudacao, introducao morna, preparacao desnecessaria ou segundos mortos.",
    "- Nao comece no meio de uma frase.",
    "- Pode avancar o start_seconds ate uma fala mais forte se o trecho continuar compreensivel.",
    "- Curiosidade e boa; confusao nao. Quem nunca viu o video original precisa entender o essencial.",
    "- Cada corte deve funcionar sozinho sem depender do contexto anterior do video.",
    "- Duracao permitida: de 5 a 90 segundos.",
    "- Use somente o tempo necessario. Um corte excelente de 8 segundos e melhor que um corte mediano de 45 segundos.",
    "- Comece EXATAMENTE onde o hook forte comeca, sem carregar contexto desnecessario antes.",
    "- Depois do hook, mantenha apenas o desenvolvimento necessario para sustentar a curiosidade.",
    "- O corte deve terminar em payoff: resposta, conclusao, punchline, consequencia, revelacao, reacao ou resolucao.",
    "- Nunca termine no meio de uma frase, explicacao ou raciocinio.",
    "- Se existe hook forte mas nao existe conclusao, descarte o corte.",
    "- Se existe conclusao mas os primeiros 1-3 segundos sao fracos, procure outro inicio ou descarte.",
    "- Nao invente, reescreva ou reorganize falas. Apenas escolha start_seconds e end_seconds existentes no conteudo.",
    "- Nunca devolva cortes sobrepostos ou repetidos.",
    "- Roteie cada corte para a UNICA conta cujo nicho e tom realmente combinam. Se nenhuma combina, nao crie o corte.",
    "- Score 0-100 deve considerar principalmente: hook nos primeiros 1-3s, retencao provavel, clareza sem contexto, payoff e potencial de compartilhamento.",
    "- Nao aumente score para preencher cota. Pode devolver poucos cortes ou nenhum.",
    "- Caption curta e natural, sem inventar fatos.",
    "- on_screen_title com no maximo 9 palavras.",
    "",
    "TRANSCRICAO COM TIMESTAMPS:",
    timestamped,
    "",
    'Responda SOMENTE JSON: {"clips":[{"account_id":"uuid","start_seconds":0,"end_seconds":40,"topic":"","hook":"","on_screen_title":"","caption":"","score":85,"reason":""}]}',
  ].join("\n");

  const parsed = await gemini([{ text: prompt }], "Pense como um Creative Strategist de short-form obcecado pelos primeiros 1-3 segundos, retencao e payoff. Qualidade acima de quantidade. E melhor devolver poucos cortes excelentes ou nenhum do que preencher cota. Responda apenas JSON.");
  const accountIds = new Set(accounts.map((a) => a.id));
  const seen: any[] = [];
  return (parsed.clips || [])
    .map((c: any) => ({ ...c, start_seconds: Number(c.start_seconds), end_seconds: Number(c.end_seconds), score: Number(c.score) || 0 }))
    .filter((c: any) => accountIds.has(c.account_id))
    .filter((c: any) => Number.isFinite(c.start_seconds) && Number.isFinite(c.end_seconds))
    .filter((c: any) => c.end_seconds - c.start_seconds >= 5 && c.end_seconds - c.start_seconds <= 90)
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
          { fallbackModels: ["gemini-2.5-flash-lite"] },
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
          // Idempotência sem depender de unique constraint: lê as dedupe_key já
          // existentes deste vídeo e insere apenas as novas.
          const { data: existing, error: readError } = await admin.from("clips")
            .select("dedupe_key").eq("source_video_id", job.id);
          if (readError) throw readError;
          const known = new Set((existing || []).map((r: any) => r.dedupe_key));
          const fresh: any[] = [];
          for (const row of rows) {
            if (known.has(row.dedupe_key)) continue;
            known.add(row.dedupe_key);
            fresh.push(row);
          }
          if (fresh.length) {
            const { error } = await admin.from("clips").insert(fresh);
            if (error) throw error;
          }
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
