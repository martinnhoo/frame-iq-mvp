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

const FN_VERSION = "v3-caption-fidelity-2026-05-07";

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
  image_url: string;       // URL pública (Storage) ou data URL
  ref_id?: string;         // id pro caller correlacionar (frontend file id)
}

interface CaptionResult {
  image_url: string;
  ref_id?: string;
  fb_caption: string;      // 4 linhas com emojis
  tiktok_caption: string;  // ≤95 chars sem emojis
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

// Chama OpenAI GPT-4o-mini com vision pra UMA imagem.
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
  imageUrl: string,
  marketCtx: { lang: string; instructions: string } | null,  // null = auto-detect
  brandHint: string,
  apiKey: string,
): Promise<{ fb_caption: string; tiktok_caption: string; error?: string }> {
  const langSection = marketCtx
    ? `OUTPUT LANGUAGE — FORCED: ${marketCtx.lang}\n${marketCtx.instructions}\nDO NOT use any other language. Translate visible image text to this language if needed for the caption.`
    : `OUTPUT LANGUAGE — AUTO-DETECT FROM IMAGE:
- Look at the visible text inside the image (banners, copy, watermarks).
- Generate the captions in the SAME language as that visible text.
- If the image text is in English → write captions in English.
- If text is in Spanish → write in Spanish.
- If text is in Portuguese → write in pt-BR.
- If text is in Hindi/Hinglish → write in Hinglish (Latin script, never Devanagari).
- If NO visible text → use the brand context if present; otherwise default to English.`;

  const prompt = `You are a senior social media copywriter for advertising creatives.

CRITICAL RULES — DO NOT VIOLATE:
1. Captions must DESCRIBE what is actually visible in the image. Do NOT invent offers, products, or details that are not in the image.
2. If the image shows a person doing X (e.g., "talking on the phone"), the caption must reflect that — not generic casino copy.
3. If the image has visible text/copy/CTA, REUSE that language and message — do not replace it.
4. Brand context is for STYLE only (color, mood, tone). It does NOT give you license to invent things. If the image is about an app, talk about the app — not slot machines just because the brand is a casino.

${langSection}

${brandHint ? `BRAND TONE/STYLE (use only for visual mood, NOT to invent content):\n${brandHint}\n` : ""}

STEP 1 — internal analysis (do NOT output, just think):
- What text is visible in the image? (transcribe exactly, in original language)
- What is the main subject? (person doing what? object? scene?)
- What action/offer/CTA is being communicated?
- What language is the visible text?

STEP 2 — write captions based ONLY on what you saw in step 1.

Generate TWO captions, EACH on its own labeled section:

==FB==
${FB_FORMAT_INSTRUCTION}

==TIKTOK==
${TIKTOK_FORMAT_INSTRUCTION}

Output ONLY the two sections, exactly in this order:
==FB==
{4 lines here}
==TIKTOK==
{1 line here, max 95 chars, no emojis}

No preamble, no explanation, no analysis output. Just the two sections.`;

  if (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:")) {
    return { fb_caption: "", tiktok_caption: "", error: "invalid_image_url" };
  }

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
        temperature: 0.4, // mais conservador — menos invenção
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            // detail "high" = lê texto pequeno/elementos finos. Custo
            // ~10x detail=low mas vital pra fidelidade.
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
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

    // Processa em paralelo (cap de 3 pra não estourar rate limit Claude)
    const CONC = 3;
    const results: CaptionResult[] = [];
    for (let i = 0; i < images.length; i += CONC) {
      const batch = images.slice(i, i + CONC);
      const batchResults = await Promise.all(batch.map(async (img) => {
        const r = await generateCaptionsForImage(img.image_url, marketCtx, brandHint, OPENAI_API_KEY);
        return {
          image_url: img.image_url,
          ref_id: img.ref_id,
          fb_caption: r.fb_caption,
          tiktok_caption: r.tiktok_caption,
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
