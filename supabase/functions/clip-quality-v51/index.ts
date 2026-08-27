import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const WORKER_SECRET = Deno.env.get("CLIP_WORKER_SECRET") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const HEADLINE_MODEL = Deno.env.get("CLIP_HEADLINE_MODEL") || "gpt-5.4-mini";
const DIARIZE_MODEL = Deno.env.get("CLIP_DIARIZE_MODEL") || "gpt-4o-transcribe-diarize";
const ACCURATE_MODEL = Deno.env.get("CLIP_ACCURATE_TRANSCRIBE_MODEL") || "gpt-4o-transcribe";
const TIMING_MODEL = "whisper-1";

const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clean = (v: unknown, max = 500) =>
  String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function assertWorker(req: Request) {
  if (!WORKER_SECRET) throw new Error("CLIP_WORKER_SECRET não configurado");
  if ((req.headers.get("x-clip-worker-secret") || "") !== WORKER_SECRET) {
    throw new Error("unauthorized");
  }
}

function bytesFromBase64(value: string) {
  const binary = atob(value || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function extForMime(mime: string) {
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("webm")) return "webm";
  return "mp3";
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 2) {
  let lastStatus = 0;
  let lastText = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      if (res.ok) return { res, text, attempts: attempt };
      lastStatus = res.status;
      lastText = text;
      if (!TRANSIENT.has(res.status) || attempt === attempts) {
        throw new Error(`OpenAI falhou (${res.status}): ${text.slice(0, 700)}`);
      }
    } catch (error) {
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(800 * attempt);
  }
  throw new Error(`OpenAI falhou (${lastStatus}): ${lastText.slice(0, 700)}`);
}

function audioForm(
  audioBase64: string,
  mimeType: string,
  model: string,
  extra: Record<string, string | string[]> = {},
) {
  const form = new FormData();
  const bytes = bytesFromBase64(audioBase64);
  form.append("file", new Blob([bytes], { type: mimeType }), `clip.${extForMime(mimeType)}`);
  form.append("model", model);
  for (const [key, value] of Object.entries(extra)) {
    if (Array.isArray(value)) {
      for (const item of value) form.append(key, item);
    } else if (value !== "") {
      form.append(key, value);
    }
  }
  return form;
}

async function whisperTiming(
  audioBase64: string,
  mimeType: string,
  language: string,
  context: string,
) {
  const form = audioForm(audioBase64, mimeType, TIMING_MODEL, {
    response_format: "verbose_json",
    language,
    prompt: clean(context, 900),
  });
  form.append("timestamp_granularities[]", "segment");
  form.append("timestamp_granularities[]", "word");

  const { text, attempts } = await fetchWithRetry(
    "https://api.openai.com/v1/audio/transcriptions",
    { method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: form },
    2,
  );
  const body = JSON.parse(text);
  const words = (body.words || [])
    .map((w: any) => ({
      word: clean(w.word, 80),
      start: Number(w.start) || 0,
      end: Number(w.end) || 0,
    }))
    .filter((w: any) => w.word && w.end > w.start);
  return { words, body, attempts };
}

async function diarize(
  audioBase64: string,
  mimeType: string,
  language: string,
) {
  const form = audioForm(audioBase64, mimeType, DIARIZE_MODEL, {
    response_format: "diarized_json",
    language,
    chunking_strategy: "auto",
  });
  const { text, attempts } = await fetchWithRetry(
    "https://api.openai.com/v1/audio/transcriptions",
    { method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: form },
    2,
  );
  const body = JSON.parse(text);
  const segments = (body.segments || [])
    .map((s: any) => ({
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      text: clean(s.text, 1000),
      speaker_id: clean(s.speaker || "unknown", 60),
    }))
    .filter((s: any) => s.text && s.end > s.start);
  if (!segments.length) throw new Error("Diarização retornou zero segmentos");
  return { body, segments, attempts };
}

async function accuratePlain(
  audioBase64: string,
  mimeType: string,
  language: string,
  context: string,
) {
  const form = audioForm(audioBase64, mimeType, ACCURATE_MODEL, {
    response_format: "json",
    language,
    prompt: clean(context, 900),
  });
  const { text, attempts } = await fetchWithRetry(
    "https://api.openai.com/v1/audio/transcriptions",
    { method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: form },
    2,
  );
  const body = JSON.parse(text);
  const transcriptText = clean(body.text, 20_000);
  if (!transcriptText) throw new Error("Transcrição precisa retornou vazia");
  return {
    body,
    segments: [{
      start: 0,
      end: Number(body.duration) || 0,
      text: transcriptText,
      speaker_id: null,
    }],
    attempts,
  };
}

function tokenize(text: string) {
  return String(text || "")
    .match(/\S+/g)
    ?.map((token) => token.trim())
    .filter(Boolean) || [];
}

function norm(token: string) {
  return String(token || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function alignTokens(timed: any[], accurateTokens: string[]) {
  const m = timed.length;
  const n = accurateTokens.length;
  if (!n) return [];
  if (!m) return accurateTokens.map((word) => ({ word, timingIndex: null }));

  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  const op = Array.from({ length: m + 1 }, () => Array(n + 1).fill(""));
  for (let i = 1; i <= m; i += 1) { dp[i][0] = i; op[i][0] = "up"; }
  for (let j = 1; j <= n; j += 1) { dp[0][j] = j; op[0][j] = "left"; }

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const same = norm(timed[i - 1].word) === norm(accurateTokens[j - 1]);
      const diag = dp[i - 1][j - 1] + (same ? 0 : 1);
      const up = dp[i - 1][j] + 1;
      const left = dp[i][j - 1] + 1;
      const best = Math.min(diag, up, left);
      dp[i][j] = best;
      op[i][j] = best === diag ? "diag" : best === up ? "up" : "left";
    }
  }

  const mapping = Array(n).fill(null);
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const step = op[i][j];
    if (step === "diag") {
      mapping[j - 1] = i - 1;
      i -= 1;
      j -= 1;
    } else if (step === "up") {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return accurateTokens.map((word, index) => ({ word, timingIndex: mapping[index] }));
}

function wordsForSegment(segment: any, timingWords: any[]) {
  const accurate = tokenize(segment.text);
  if (!accurate.length) return [];

  const overlapping = timingWords.filter((word) => {
    const mid = (Number(word.start) + Number(word.end)) / 2;
    return mid >= segment.start - 0.12 && mid <= segment.end + 0.12;
  });

  const aligned = alignTokens(overlapping, accurate);
  const out = aligned.map((item) => {
    const timing = item.timingIndex == null ? null : overlapping[item.timingIndex];
    return {
      word: item.word,
      start: timing ? clamp(Number(timing.start), segment.start, segment.end) : null,
      end: timing ? clamp(Number(timing.end), segment.start, segment.end) : null,
      speaker_id: segment.speaker_id,
    };
  });

  let cursor = 0;
  while (cursor < out.length) {
    if (out[cursor].start != null && out[cursor].end != null) {
      cursor += 1;
      continue;
    }
    let endRun = cursor;
    while (endRun + 1 < out.length && out[endRun + 1].start == null) endRun += 1;
    const left = cursor > 0 && out[cursor - 1].end != null
      ? Number(out[cursor - 1].end)
      : Number(segment.start);
    const right = endRun + 1 < out.length && out[endRun + 1].start != null
      ? Number(out[endRun + 1].start)
      : Number(segment.end);
    const count = endRun - cursor + 1;
    const span = Math.max(0.08 * count, right - left);
    const step = span / count;
    for (let k = cursor; k <= endRun; k += 1) {
      const local = k - cursor;
      out[k].start = clamp(left + step * local, segment.start, segment.end);
      out[k].end = clamp(left + step * (local + 1), Number(out[k].start) + 0.03, segment.end);
    }
    cursor = endRun + 1;
  }

  let previousEnd = Number(segment.start);
  for (const word of out) {
    word.start = clamp(Math.max(Number(word.start), previousEnd), segment.start, segment.end);
    word.end = clamp(Math.max(Number(word.end), Number(word.start) + 0.03), Number(word.start), segment.end);
    previousEnd = Number(word.end);
  }
  return out.filter((word) => Number(word.end) > Number(word.start));
}

function buildWords(segments: any[], timingWords: any[]) {
  const words = segments.flatMap((segment) => wordsForSegment(segment, timingWords));
  return words.sort((a, b) => Number(a.start) - Number(b.start));
}

async function transcribeV51(payload: any) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurado");
  const audioBase64 = String(payload.audio_base64 || "");
  const mimeType = String(payload.mime_type || "audio/mpeg");
  const language = clean(payload.language || "pt", 10) || "pt";
  const context = clean(payload.context, 900);
  if (!audioBase64) throw new Error("audio_base64 obrigatório");

  const timing = await whisperTiming(audioBase64, mimeType, language, context);

  let accurate: any;
  let backend = "";
  let fallbackUsed = false;
  let diarizationError: string | null = null;

  try {
    accurate = await diarize(audioBase64, mimeType, language);
    backend = `${DIARIZE_MODEL}+${TIMING_MODEL}_timing_v51`;
  } catch (error) {
    diarizationError = clean((error as Error)?.message || error, 700);
    fallbackUsed = true;
    const plain = await accuratePlain(audioBase64, mimeType, language, context);
    const duration = Number(timing.body?.duration)
      || Number(timing.words.at(-1)?.end)
      || 0;
    accurate = {
      ...plain,
      segments: plain.segments.map((segment: any) => ({ ...segment, end: duration || segment.end })),
    };
    backend = `${ACCURATE_MODEL}+${TIMING_MODEL}_timing_v51`;
  }

  const words = buildWords(accurate.segments, timing.words);
  if (!words.length) throw new Error("V5.1 não conseguiu produzir palavras alinhadas");

  const speakerIds = new Set(
    words.map((word) => word.speaker_id).filter((value) => value && value !== "unknown"),
  );
  return {
    ok: true,
    version: "5.1",
    backend,
    accuracy_model: fallbackUsed ? ACCURATE_MODEL : DIARIZE_MODEL,
    timing_model: TIMING_MODEL,
    fallback_used: fallbackUsed,
    diarization_error: diarizationError,
    text: accurate.body?.text || accurate.segments.map((s: any) => s.text).join(" "),
    segments: accurate.segments,
    words,
    speaker_count: speakerIds.size,
    word_count: words.length,
    attempts: {
      timing: timing.attempts,
      accuracy: accurate.attempts || 1,
    },
  };
}

function normalizeHeadlineText(value: unknown) {
  return clean(value, 74)
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function headlineV51(payload: any) {
  if (!OPENAI_API_KEY) {
    return { ok: true, headline: { enabled: false, preset: "none", text: "", duration: 0 }, source: "disabled_no_key", score: 0 };
  }
  const transcript = clean(payload.transcript, 7000);
  const videoTitle = clean(payload.video_title, 300);
  const originalTitle = normalizeHeadlineText(payload.original_title);
  if (!transcript) {
    return { ok: true, headline: { enabled: false, preset: "none", text: "", duration: 0 }, source: "disabled_no_transcript", score: 0 };
  }

  const system =
    "Você é editor-chefe de Reels/Shorts em português do Brasil. Crie embalagem editorial curta, humana e específica. " +
    "Headline deve ADICIONAR contexto ou curiosidade, nunca só descrever a imagem, nunca inventar fato e nunca soar clickbait genérico. Responda somente JSON.";

  const user = [
    "Analise a fala abaixo e gere exatamente 3 candidatos de headline.",
    "Cada headline: 3–9 palavras, ideal até 55 caracteres.",
    "Presets permitidos: bold_top_banner, social_post, news_red_bar, clean_minimal.",
    "Dê score 0–100 para utilidade real no vídeo.",
    "Se o áudio já se sustenta ou nenhuma opção atingir 78, use_headline=false.",
    "NÃO copie literalmente o título original do candidato. Ele é apenas contexto e pode estar ruim.",
    `Título do vídeo-fonte: ${videoTitle}`,
    `Título antigo do candidato (NÃO reutilizar): ${originalTitle}`,
    `Transcrição corrigida do corte: ${transcript}`,
    'JSON: {"use_headline":true,"selected_index":0,"candidates":[{"text":"...","preset":"bold_top_banner","score":86,"reason":"..."}]}',
  ].join("\n");

  try {
    const { text } = await fetchWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: HEADLINE_MODEL,
          response_format: { type: "json_object" },
          temperature: 0.35,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      },
      2,
    );
    const body = JSON.parse(text);
    const parsed = JSON.parse(body?.choices?.[0]?.message?.content || "{}");
    const allowed = new Set(["bold_top_banner", "social_post", "news_red_bar", "clean_minimal"]);
    const candidates = (Array.isArray(parsed.candidates) ? parsed.candidates : [])
      .slice(0, 3)
      .map((candidate: any) => ({
        text: normalizeHeadlineText(candidate.text),
        preset: allowed.has(String(candidate.preset)) ? String(candidate.preset) : "bold_top_banner",
        score: clamp(Number(candidate.score) || 0, 0, 100),
        reason: clean(candidate.reason, 180),
      }))
      .filter((candidate: any) => candidate.text);

    const selectedIndex = Number.isInteger(Number(parsed.selected_index))
      ? clamp(Number(parsed.selected_index), 0, Math.max(0, candidates.length - 1))
      : 0;
    const selected = candidates[selectedIndex]
      || [...candidates].sort((a, b) => b.score - a.score)[0]
      || null;

    const sameAsOld = selected && originalTitle
      ? norm(selected.text) === norm(originalTitle)
      : false;
    const enabled = Boolean(
      parsed.use_headline === true
      && selected
      && selected.score >= 78
      && !sameAsOld,
    );

    return {
      ok: true,
      source: "openai_headline_v51",
      model: HEADLINE_MODEL,
      score: selected?.score || 0,
      candidates,
      selected_index: selected ? candidates.indexOf(selected) : -1,
      rejected_old_title_copy: sameAsOld,
      headline: enabled
        ? {
            enabled: true,
            preset: selected.preset,
            text: selected.text,
            duration: 3.2,
          }
        : {
            enabled: false,
            preset: "none",
            text: "",
            duration: 0,
          },
    };
  } catch (error) {
    return {
      ok: true,
      source: "disabled_headline_error",
      score: 0,
      error: clean((error as Error)?.message || error, 700),
      candidates: [],
      headline: { enabled: false, preset: "none", text: "", duration: 0 },
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    assertWorker(req);
    const { action, payload = {} } = await req.json();
    if (action === "ping") {
      return json({
        ok: true,
        version: "5.1",
        diarize_model: DIARIZE_MODEL,
        timing_model: TIMING_MODEL,
        accurate_fallback_model: ACCURATE_MODEL,
        headline_model: HEADLINE_MODEL,
      });
    }
    if (action === "transcribe") return json(await transcribeV51(payload));
    if (action === "headline") return json(await headlineV51(payload));
    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    const message = clean((error as Error)?.message || error, 1600);
    return json({ error: message }, message === "unauthorized" ? 401 : 500);
  }
});
