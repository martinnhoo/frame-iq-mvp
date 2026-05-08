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

const FN_VERSION = "v1-caption-gen-2026-05-07";

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

// Mapa market → idioma da legenda
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
// Bem mais barato que Claude Haiku: ~$0.0001/img vs $0.001/img (10x menos).
// Retorna { fb_caption, tiktok_caption }.
async function generateCaptionsForImage(
  imageUrl: string,
  marketCtx: { lang: string; instructions: string },
  brandHint: string,
  apiKey: string,
): Promise<{ fb_caption: string; tiktok_caption: string; error?: string }> {
  const prompt = `You are a social media captions expert for iGaming/casino brands.

Analyze the provided image and write captions FOR IT — both must reference what's IN the image (subject, mood, offer).

LANGUAGE: ${marketCtx.lang}
${marketCtx.instructions}

${brandHint ? `BRAND CONTEXT:\n${brandHint}\n` : ""}

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

No other text. No preamble. No explanation. Just the two sections.`;

  // OpenAI vision aceita tanto URL quanto data URL no campo image_url.url.
  // Pra performance, GPT-4o-mini com detail="low" é mais rápido e suficiente
  // pra entender contexto geral de ad creative.
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
        max_tokens: 600,
        temperature: 0.7,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
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
    } = body as {
      images?: CaptionInputImage[];
      brand_id?: string | null;
      market?: string | null;
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

    const marketCtx = (market && MARKET_LANG[market]) || MARKET_LANG.BR;
    const brandHint = (brand_id && BRAND_HINTS[brand_id]) || "";

    console.log(`[hub-caption-gen] start user=${authUser.id} count=${images.length} market=${market} brand=${brand_id}`);

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
              language: marketCtx.lang,
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
