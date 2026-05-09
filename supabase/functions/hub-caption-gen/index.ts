// hub-caption-gen — gera legendas TikTok + Facebook a partir de imagens.
//
// Recebe: { images: [{ image_url, ref_id? }], brand_id?, market?, language? }
// Para cada imagem:
//   1. GPT-4o-mini (vision, detail=low) analisa a imagem
//   2. Gera FB caption (4 linhas, emoji + frase + emoji, formato user)
//   3. Gera TikTok caption (≤95 chars, sem emojis)
//   4. Retorna { image_url, ref_id, fb, tiktok }
// Salva em hub_assets kind="hub_caption" pra Library.
//
// Custo: ~$0.0001 por imagem (gpt-4o-mini detail=low ~85 tokens/img +
// ~600 tokens output). 100 imagens = ~$0.01.
//
// Idioma das legendas: deriva de market (BR=pt-BR, MX/CO/PE=es, US=en, IN=hinglish).

const FN_VERSION = "v4-caption-video-2026-05-07";

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface CaptionInputImage {
  image_url: string;       // URL pública (Storage) ou data URL — frame principal/cover
  ref_id?: string;         // id pro caller correlacionar (frontend file id)
  // Pra vídeo: array de URLs de frames-chave (início/meio/fim).
  // Quando presente, IA analisa todos os frames como UMA sequência.
  frames?: string[];
  // Pra vídeo: URL pública do MP4 pra Whisper transcrever áudio.
  // Quando presente, server faz transcript e usa como contexto.
  video_url?: string;
}

interface CaptionResult {
  image_url: string;
  ref_id?: string;
  fb_caption: string;      // 4 linhas com emojis
  tiktok_caption: string;  // ≤95 chars sem emojis
  media_type?: "image" | "video";
  transcript?: string;     // se vídeo + áudio detectado
  error?: string;
}

// Mapa market → idioma da legenda. User pode override via body.language
// (vai pro mesmo formato { lang, instructions } via LANGUAGE_OPTIONS).
const MARKET_LANG: Record<string, { lang: string; instructions: string }> = {
  BR: {
    lang: "pt-BR",
    instructions: "Português brasileiro. Tom direto e moderno. Use moeda R$ e termos brasileiros (PIX, saque, depósito).",
  },
  MX: {
    lang: "es-MX",
    instructions: "Español mexicano. Tom directo. Use moneda MXN. Términos: depósito, giros gratis, juega, retiro.",
  },
  CO: {
    lang: "es-CO",
    instructions: "Español colombiano. Tom amigable. Use COP. Términos: depósito, giros, jugar, retirar.",
  },
  PE: {
    lang: "es-PE",
    instructions: "Español peruano. Use PEN. Términos directos: apuesta, depósito, juega.",
  },
  US: {
    lang: "en-US",
    instructions: "American English. Direct and modern. Use $ and terms like deposit, spin, play, win.",
  },
  IN: {
    lang: "hinglish",
    instructions: "HINGLISH (Hindi mixed with English in Latin/Roman script — NEVER Devanagari). Examples: 'Aaj join karo', 'Bonus milega', 'Real rewards'. Never 'आज जुड़ें'. Use ₹ for currency.",
  },
};

const FB_FORMAT_INSTRUCTION = `
Facebook caption format — STRICT 4 LINES, each with: EMOJI + 2-4 word phrase + SAME EMOJI.

Format pattern:
{emoji1} {phrase 1} {emoji1}
 {emoji2} {phrase 2} {emoji2}
 {emoji3} {phrase 3} {emoji3}
 {emoji4} {phrase 4} {emoji4}

Note: lines 2-4 START with single space (" ") for indentation.

Emoji vocabulary (pick ONE per line, varied):
- 🎯 (target, focus)
- 🎰 (slot machine, casino)
- ⚽ (sports betting)
- 🎮 (gaming)
- 💰 (money, rewards)
- 🏆 (trophy, win)
- ⚡ (speed, easy)
- 🔥 (hot, action)

Each line must be SHORT (2-4 words max). No periods. No commas. ALL CAPS NOT REQUIRED.

Examples:
🎯 Aaj join karo 🎯
 💰 Real rewards 💰
 ⚡ Quick entry ⚡
 🔥 Play now 🔥

🎰 150% en slots 🎰
 💰 Hasta 7,500 MXN 💰
 ⚡ Giros gratis ⚡
 🔥 Gira ahora 🔥
`;

const TIKTOK_FORMAT_INSTRUCTION = `
TikTok caption — 1 sentence, MAX 95 CHARACTERS (count carefully), NO EMOJIS.

Tone: direct, descriptive of the image content + clear CTA. No hashtags.

Examples:
"Slot machine cassino com luzes douradas. Cadastra grátis e ganha rodadas no primeiro depósito."
"Bônus de 200% até R$ 500 no primeiro depósito. Cassino premium estilo Las Vegas."
`;

// Whisper: transcreve o áudio do vídeo. Custo $0.006/min. Vídeo de
// 30s = $0.003. Aceita mp3/mp4/mpeg/mpga/m4a/wav/webm. Limite 25MB
// no upload pra Whisper API. Pra vídeos grandes, downsample não é
// trivial — aceita até 25MB por enquanto. Vídeos maiores: skip
// transcript (usa só visual).
async function whisperTranscribe(
  videoUrl: string,
  apiKey: string,
): Promise<{ transcript: string | null; error?: string }> {
  try {
    // Download do vídeo do Storage
    const dl = await fetch(videoUrl);
    if (!dl.ok) return { transcript: null, error: `dl_${dl.status}` };
    const blob = await dl.blob();
    const sizeMB = blob.size / 1024 / 1024;
    if (sizeMB > 24.5) {
      console.warn(`[whisper] video too large for Whisper (${sizeMB.toFixed(1)}MB > 25MB) — skipping transcript`);
      return { transcript: null, error: "video_too_large_for_whisper" };
    }

    // Whisper API multipart
    const fd = new FormData();
    fd.append("file", blob, "video.mp4");
    fd.append("model", "whisper-1");
    fd.append("response_format", "text");
    // Auto-detect language
    // fd.append("language", "auto");  // não precisa, default é auto

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: fd,
    });
    if (!res.ok) {
      const err = await res.text();
      return { transcript: null, error: `whisper_${res.status}: ${err.slice(0, 150)}` };
    }
    const transcript = (await res.text()).trim();
    return { transcript: transcript || null };
  } catch (e) {
    return { transcript: null, error: `whisper_exc: ${String(e).slice(0, 100)}` };
  }
}

// Chama OpenAI GPT-4o-mini com vision pra UMA imagem ou vídeo (3 frames).
// detail="high" pra ler texto/elementos com fidelidade. Custo ~$0.001/img
// (10x mais que detail=low, mas legenda errada custa MUITO mais — perde
// venda e queima trust). 100 imgs = ~$0.10. Aceitável.
//
// Estratégia anti-invenção:
//   1. Modelo PRIMEIRO descreve o que vê (texto visível, subjects, oferta)
//   2. PRIMEIRO detecta lang dominante do texto na imagem
//   3. SE language=null E market=null → usa lang detectada
//   4. SE language ou market setado → usa esse, mas legenda DEVE
//      descrever apenas o que está NA imagem (não inventar oferta)
//   5. brand_hint = só estilo/tom; NÃO invento oferta da brand
async function generateCaptionsForImage(
  imageUrls: string[],            // 1+ imagens (1 = imagem, 3 = vídeo)
  isVideo: boolean,               // true → frames de vídeo
  transcript: string | null,      // só pra vídeo (pode ser null se Whisper falhou)
  marketCtx: { lang: string; instructions: string } | null,  // null = auto-detect
  brandHint: string,
  apiKey: string,
): Promise<{ fb_caption: string; tiktok_caption: string; error?: string }> {
  const langSection = marketCtx
    ? `OUTPUT LANGUAGE — FORCED: ${marketCtx.lang}\n${marketCtx.instructions}\nDO NOT use any other language. Translate visible content to this language if needed.`
    : `OUTPUT LANGUAGE — AUTO-DETECT FROM CONTENT:
- Look at the visible text in the ${isVideo ? "video frames" : "image"} (banners, copy, watermarks).
${transcript ? "- Also consider the audio transcript provided below.\n" : ""}- Generate captions in the SAME language as the dominant content language.
- English content → English captions. Spanish → Spanish. Portuguese → pt-BR. Hindi → Hinglish (Latin script).
- If NO visible/audible language → use brand context if present; otherwise default to English.`;

  const mediaIntro = isVideo
    ? `INPUT TYPE: Video (${imageUrls.length} key frames provided in chronological order: start, middle, end).
${transcript ? `\nAUDIO TRANSCRIPT (Whisper):\n"""${transcript.slice(0, 1500)}"""\n\nUse the transcript as the PRIMARY source of message — it contains the spoken offer/CTA. Frames give visual context.\n` : "\nNo audio transcript available (silent video, audio extraction failed, or video too large for Whisper). Rely on visual frames only.\n"}`
    : `INPUT TYPE: Single image.\n`;

  const prompt = `You are a senior social media copywriter for advertising creatives.

${mediaIntro}

CRITICAL RULES — DO NOT VIOLATE:
1. Captions must DESCRIBE what is actually shown/said. Do NOT invent offers, products, or details that are not in the input.
2. If a person does X or says X, the caption must reflect that — not generic casino copy.
3. If there's visible text/copy/CTA${isVideo ? " or audio transcript" : ""}, REUSE that message — do not replace it.
4. Brand context is for STYLE only (color, mood, tone). It does NOT give you license to invent things.

${langSection}

${brandHint ? `BRAND TONE/STYLE (only visual mood, NOT to invent content):\n${brandHint}\n` : ""}

STEP 1 — internal analysis (do NOT output):
- ${isVideo ? "Watch the frame sequence: what action unfolds? What changes between frames?" : "What text is visible? What is the main subject?"}
${transcript ? "- What does the audio transcript say? What's the call-to-action spoken?\n" : ""}- What language dominates the content?
- What single message/offer is being communicated?

STEP 2 — write captions based ONLY on what you analyzed.

Generate TWO captions:

==FB==
${FB_FORMAT_INSTRUCTION}

==TIKTOK==
${TIKTOK_FORMAT_INSTRUCTION}

Output ONLY the two sections, in this order:
==FB==
{4 lines here}
==TIKTOK==
{1 line here, max 95 chars, no emojis}

No preamble. No explanation. No analysis output. Just the two sections.`;

  if (imageUrls.length === 0) {
    return { fb_caption: "", tiktok_caption: "", error: "no_images" };
  }
  for (const u of imageUrls) {
    if (!u.startsWith("http") && !u.startsWith("data:")) {
      return { fb_caption: "", tiktok_caption: "", error: "invalid_image_url" };
    }
  }

  // Monta content: 1 text prompt + N image_url (até 4 frames pra não estourar tokens)
  const imagesContent = imageUrls.slice(0, 4).map(url => ({
    type: "image_url" as const,
    image_url: { url, detail: "high" as const },
  }));

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 700,
        temperature: 0.4,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imagesContent,
          ],
        }],
      }),
    });
  } catch (e) {
    return { fb_caption: "", tiktok_caption: "", error: `network: ${String(e).slice(0, 100)}` };
  }

  if (!res.ok) {
    const errText = await res.text();
    return { fb_caption: "", tiktok_caption: "", error: `openai_${res.status}: ${errText.slice(0, 200)}` };
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || "";
  if (!text) return { fb_caption: "", tiktok_caption: "", error: "openai_no_text" };

  // Parse: ==FB== ... ==TIKTOK== ...
  const fbMatch = text.match(/==FB==\s*\n([\s\S]*?)(?=\n==TIKTOK==|$)/);
  const tiktokMatch = text.match(/==TIKTOK==\s*\n([\s\S]+?)$/);
  let fb = (fbMatch?.[1] || "").trim();
  let tiktok = (tiktokMatch?.[1] || "").trim();

  // Limpa quotes/markdown que Claude às vezes adiciona
  tiktok = tiktok.replace(/^["'`]|["'`]$/g, "").replace(/^[-*]\s*/, "").trim();
  // Garante ≤95 chars
  if (tiktok.length > 95) tiktok = tiktok.slice(0, 92).trim() + "...";

  return { fb_caption: fb, tiktok_caption: tiktok };
}

// Brand context server-side (mirror de hubBrands.ts — minimal)
const BRAND_HINTS: Record<string, string> = {
  betbus:    "BETBUS — online casino & sports betting brand. Bold red/gold accents, premium gaming.",
  eluck:     "ELUCK — online casino multi-mercado. Vibrant green/gold, modern energetic.",
  come:      "COME.COM — online casino India. Saffron/red, modern tech-forward.",
  funilive:  "FUNILIVE — Live casino. Purple/magenta, dynamic and youthful.",
};

// ── Main handler ──────────────────────────────────────────────────
console.log(`[hub-caption-gen] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "openai_key_missing",
        message: "Configure OPENAI_API_KEY nos secrets do Supabase Edge Functions.",
      }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData } = await sb.auth.getUser(authHeader.slice(7));
    const authUser = userData?.user;
    if (!authUser) return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const {
      images,
      brand_id = null,
      market = null,
      language = null,
    } = body as {
      images?: CaptionInputImage[];
      brand_id?: string | null;
      market?: string | null;
      language?: string | null;
    };

    if (!Array.isArray(images) || images.length === 0) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "no_images",
        message: "Envie pelo menos 1 imagem (campo images).",
      }, 400);
    }
    if (images.length > 10) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "too_many_images",
        message: "Máximo 10 imagens por chamada.",
      }, 400);
    }

    // Resolução de marketCtx:
    //   - language explícito (override do user) → usa esse
    //   - senão se market setado → deriva do market
    //   - senão → null (auto-detect da imagem dentro do Claude prompt)
    //
    // Antes default era pt-BR — bug: quando user marcava "Auto" sem
    // brand+market, sempre saía em PT mesmo se imagem tivesse texto EN.
    const LANGUAGE_OVERRIDE: Record<string, { lang: string; instructions: string }> = {
      "pt-BR":    MARKET_LANG.BR,
      "es-MX":    MARKET_LANG.MX,
      "es-CO":    MARKET_LANG.CO,
      "es-PE":    MARKET_LANG.PE,
      "en-US":    MARKET_LANG.US,
      "hinglish": MARKET_LANG.IN,
    };
    const marketCtx: { lang: string; instructions: string } | null =
      (language && LANGUAGE_OVERRIDE[language])
      || (market && MARKET_LANG[market])
      || null;
    const brandHint = (brand_id && BRAND_HINTS[brand_id]) || "";

    console.log(`[hub-caption-gen] start user=${authUser.id} count=${images.length} market=${market} brand=${brand_id} language=${language || "(auto)"} resolved=${marketCtx?.lang || "(detect-from-image)"}`);

    // Processa em paralelo (cap de 3 pra não estourar rate limit OpenAI)
    const CONC = 3;
    const results: CaptionResult[] = [];
    for (let i = 0; i < images.length; i += CONC) {
      const batch = images.slice(i, i + CONC);
      const batchResults = await Promise.all(batch.map(async (img) => {
        // Detecta vídeo: tem frames array OU video_url
        const isVideo = (Array.isArray(img.frames) && img.frames.length > 0) || !!img.video_url;
        const visualUrls = isVideo
          ? (img.frames && img.frames.length > 0 ? img.frames : [img.image_url])
          : [img.image_url];

        // Pra vídeo com video_url, faz Whisper transcript em paralelo
        let transcript: string | null = null;
        if (isVideo && img.video_url) {
          const whisperRes = await whisperTranscribe(img.video_url, OPENAI_API_KEY);
          transcript = whisperRes.transcript;
          if (whisperRes.error) {
            console.warn(`[hub-caption-gen] whisper failed for ${img.ref_id}: ${whisperRes.error}`);
          } else if (transcript) {
            console.log(`[hub-caption-gen] transcript for ${img.ref_id}: "${transcript.slice(0, 100)}..."`);
          }
        }

        const r = await generateCaptionsForImage(
          visualUrls, isVideo, transcript,
          marketCtx, brandHint, OPENAI_API_KEY,
        );
        return {
          image_url: img.image_url,
          ref_id: img.ref_id,
          fb_caption: r.fb_caption,
          tiktok_caption: r.tiktok_caption,
          media_type: isVideo ? "video" as const : "image" as const,
          transcript: transcript || undefined,
          error: r.error,
        };
      }));
      results.push(...batchResults);
    }

    const okCount = results.filter(r => !r.error && r.fb_caption && r.tiktok_caption).length;
    console.log(`[hub-caption-gen] done — ${okCount}/${images.length} ok`);

    // Persiste cada resultado bem-sucedido em hub_assets
    const memoryIds: (string | null)[] = [];
    for (const r of results) {
      if (r.error || !r.fb_caption || !r.tiktok_caption) {
        memoryIds.push(null);
        continue;
      }
      try {
        const { data: inserted } = await sb.from("hub_assets")
          .insert({
            user_id: authUser.id,
            kind: "hub_caption",
            content: {
              image_url: r.image_url,
              fb_caption: r.fb_caption,
              tiktok_caption: r.tiktok_caption,
              media_type: r.media_type || "image",
              transcript: r.transcript || null,
              brand_id,
              market,
              language: marketCtx?.lang || "auto",
              model: "gpt-4o-mini",
            },
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        memoryIds.push(inserted?.id || null);
      } catch (e) {
        console.warn(`[hub-caption-gen] DB insert error:`, e);
        memoryIds.push(null);
      }
    }

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      results: results.map((r, i) => ({ ...r, memory_id: memoryIds[i] })),
      total: images.length,
      ok_count: okCount,
    }, 200);

  } catch (e) {
    console.error("[hub-caption-gen] unexpected:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});
