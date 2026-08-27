import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const WORKER_SECRET = Deno.env.get("CLIP_WORKER_SECRET") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const HEADLINE_MODEL = Deno.env.get("CLIP_HEADLINE_MODEL") || "gpt-5.4-mini";
const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const clean = (value: unknown, max = 500) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function assertWorker(req: Request) {
  if (!WORKER_SECRET) throw new Error("CLIP_WORKER_SECRET não configurado");
  if ((req.headers.get("x-clip-worker-secret") || "") !== WORKER_SECRET) {
    throw new Error("unauthorized");
  }
}

function norm(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function normalizeHeadlineText(value: unknown) {
  return clean(value, 74)
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 2) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      if (res.ok) return { text, attempts: attempt };
      const error = new Error(`OpenAI falhou (${res.status}): ${text.slice(0, 700)}`);
      lastError = error;
      if (!TRANSIENT.has(res.status) || attempt === attempts) throw error;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timer);
    }
    await sleep(800 * attempt);
  }
  throw lastError || new Error("OpenAI headline falhou");
}

async function headlineV511(payload: any) {
  if (!OPENAI_API_KEY) {
    return {
      ok: true,
      source: "disabled_no_key",
      score: 0,
      headline: { enabled: false, preset: "none", text: "", duration: 0 },
    };
  }

  const transcript = clean(payload.transcript, 7000);
  const videoTitle = clean(payload.video_title, 300);
  const originalTitle = normalizeHeadlineText(payload.original_title);
  if (!transcript) {
    return {
      ok: true,
      source: "disabled_no_transcript",
      score: 0,
      headline: { enabled: false, preset: "none", text: "", duration: 0 },
    };
  }

  const system =
    "Você é editor-chefe de Reels/Shorts em português do Brasil. " +
    "Crie embalagem editorial curta, humana, específica e visualmente publicável. " +
    "A headline deve adicionar contexto ou curiosidade, nunca inventar fatos e nunca soar clickbait genérico. " +
    "Escolha o formato visual que melhor combina com o momento. Responda somente JSON.";

  const prompt = [
    "Gere exatamente 3 candidatos diferentes de headline.",
    "Cada headline: 3–9 palavras, ideal até 55 caracteres.",
    "Use SOMENTE estes presets:",
    "- news_page: estilo página de notícias/cortes. Boa para notícia, contexto, celebridade, atualização ou história. Texto natural em 1–3 linhas.",
    "- viral_headline: estilo Reels/TikTok chamativo, fonte condensada/bold, 1–2 linhas. Pode usar 1–2 emojis relevantes.",
    "- media_split: vídeo em cima + freeze-frame relevante do próprio corte embaixo + faixa de headline. Use quando a composição visual melhora muito o hook.",
    "Emoji é opcional. Não use emoji aleatório ou em excesso.",
    "Dê score 0–100 para utilidade real.",
    "Se nenhuma opção atingir 78 ou o áudio já se sustenta, use_headline=false.",
    "NÃO copie literalmente o título antigo.",
    "Evite 'você não vai acreditar', 'olha isso' e clickbait genérico.",
    `Título do vídeo-fonte: ${videoTitle}`,
    `Título antigo do candidato (NÃO reutilizar): ${originalTitle}`,
    `Transcrição corrigida: ${transcript}`,
    'JSON: {"use_headline":true,"selected_index":0,"candidates":[{"text":"...","preset":"viral_headline","emoji":"😳","score":86,"reason":"..."}]}',
  ].join("\n");

  try {
    const { text, attempts } = await fetchWithRetry(
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
            { role: "user", content: prompt },
          ],
        }),
      },
      2,
    );

    const body = JSON.parse(text);
    const parsed = JSON.parse(body?.choices?.[0]?.message?.content || "{}");
    const allowed = new Set(["news_page", "viral_headline", "media_split"]);
    const candidates = (Array.isArray(parsed.candidates) ? parsed.candidates : [])
      .slice(0, 3)
      .map((candidate: any) => ({
        text: normalizeHeadlineText(candidate.text),
        preset: allowed.has(String(candidate.preset))
          ? String(candidate.preset)
          : "viral_headline",
        emoji: clean(candidate.emoji, 12),
        score: clamp(Number(candidate.score) || 0, 0, 100),
        reason: clean(candidate.reason, 180),
      }))
      .filter((candidate: any) => candidate.text);

    const requestedIndex = Number(parsed.selected_index);
    const selected =
      (Number.isInteger(requestedIndex) ? candidates[clamp(requestedIndex, 0, Math.max(0, candidates.length - 1))] : null)
      || [...candidates].sort((a, b) => b.score - a.score)[0]
      || null;

    const sameAsOld = Boolean(
      selected && originalTitle && norm(selected.text) === norm(originalTitle),
    );
    const enabled = Boolean(
      parsed.use_headline === true
      && selected
      && selected.score >= 78
      && !sameAsOld,
    );

    return {
      ok: true,
      version: "5.1.1",
      source: "openai_headline_v511",
      model: HEADLINE_MODEL,
      attempts,
      score: selected?.score || 0,
      candidates,
      selected_index: selected ? candidates.indexOf(selected) : -1,
      rejected_old_title_copy: sameAsOld,
      headline: enabled
        ? {
            enabled: true,
            preset: selected.preset,
            text: selected.text,
            emoji: selected.emoji || "",
            duration: selected.preset === "media_split" ? 90 : 2.7,
            supporting_visual:
              selected.preset === "media_split"
                ? { mode: "clip_freeze_frame" }
                : null,
          }
        : {
            enabled: false,
            preset: "none",
            text: "",
            emoji: "",
            duration: 0,
            supporting_visual: null,
          },
    };
  } catch (error) {
    return {
      ok: true,
      version: "5.1.1",
      source: "disabled_headline_error",
      score: 0,
      error: clean((error as Error)?.message || error, 700),
      candidates: [],
      headline: {
        enabled: false,
        preset: "none",
        text: "",
        emoji: "",
        duration: 0,
        supporting_visual: null,
      },
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    assertWorker(req);
    const { action, payload = {} } = await req.json();
    if (action === "ping") {
      return json({ ok: true, version: "5.1.1", headline_model: HEADLINE_MODEL });
    }
    if (action === "headline") return json(await headlineV511(payload));
    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    const message = clean((error as Error)?.message || error, 1600);
    return json({ error: message }, message === "unauthorized" ? 401 : 500);
  }
});
