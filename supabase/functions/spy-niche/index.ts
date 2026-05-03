// spy-niche v1 — Inteligência competitiva real.
//
// Diferença pro `decode-competitor`: aquele decoda 1 anúncio. Esse aqui aceita
// 3-5 anúncios concorrentes (URL Meta Ad Library / TikTok / texto colado /
// screenshot) e devolve PADRÃO DE NICHO:
//   • Top 3 hook patterns dominantes (com exemplo de qual ad usa)
//   • Formato dominante (UGC vs editado, duração, vídeo vs static)
//   • Tom/estilo predominante
//   • Ofertas e promessas mais usadas
//   • GAP EXPLORÁVEL — o que NINGUÉM tá fazendo, que dá pra atacar
//   • 5 hooks recomendados pra atacar o gap (assinados pra conta do user)
//
// Por que isso > Claude com knowledge cutoff: o user fornece DADOS REAIS
// (anúncios rodando agora), e a IA analisa esses dados em vez de chutar
// padrões genéricos do treino. Output é específico, não generalização.
//
// Auth: JWT obrigatório (verify_jwt true via config.toml).
// Credits: gasta 1 crédito do slot "competitor" (similar weight).
// Cost cap: protege user free de gastar tudo aqui.
//
// Modelo: Claude Sonnet 4 quando tem image (vision necessária pra screenshots),
// senão Haiku 4.5 (50× mais barato pra texto puro).

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireCredits } from "../_shared/deductCredits.ts";
import { checkCostCap, recordCost, capExceededResponse } from "../_shared/cost-cap.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdInput =
  | { kind: "url"; value: string }
  | { kind: "text"; value: string }
  | { kind: "image"; value: string; media_type?: string }; // base64

interface Body {
  niche?: string;
  platform?: "meta" | "tiktok";
  ads: AdInput[];
  ui_language?: "pt" | "en" | "es";
  user_account_context?: string; // optional — user's own niche/product, lets AI tailor recommended hooks
}

const log = (step: string, d?: unknown) =>
  console.log(`[SPY-NICHE] ${step}${d ? ` — ${JSON.stringify(d).slice(0, 200)}` : ""}`);

// Reused from decode-competitor — extrai conteúdo de OG tags + body de uma URL.
async function extractFromUrl(url: string): Promise<{ ok: boolean; content: string; domain: string }> {
  let domain = "";
  try { domain = new URL(url).hostname.replace("www.", ""); } catch { domain = url; }

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, content: "", domain };

    const html = await r.text();
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] || "";
    const ogDesc  = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] || "";
    const twDesc  = html.match(/<meta[^>]+name="twitter:description"[^>]+content="([^"]+)"/i)?.[1] || "";
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, " ").trim().slice(0, 2000);
    const combined = [ogTitle, ogDesc, twDesc, body].filter(Boolean).join(" | ").slice(0, 3000);
    return { ok: combined.length > 50, content: combined, domain };
  } catch (e) {
    log("url extract failed", { url: url.slice(0, 60), err: String(e).slice(0, 100) });
    return { ok: false, content: "", domain };
  }
}

const I18N = {
  pt: {
    insufficient_ads: "Mande pelo menos 3 anúncios pra eu encontrar padrão. 1-2 não é amostra suficiente.",
    too_many_ads: "Máximo 5 anúncios por análise — mais que isso vira ruído, não padrão.",
    ad_extraction_failed: (i: number, domain: string) => `Não consegui extrair conteúdo do anúncio #${i + 1} (${domain}). Cole o copy/legenda diretamente ou suba screenshot.`,
    no_ads_extractable: "Nenhum dos anúncios deu pra extrair. Tenta colar o copy direto ou subir screenshots.",
  },
  en: {
    insufficient_ads: "Send at least 3 ads — 1-2 is not a sample.",
    too_many_ads: "Max 5 ads per analysis — more becomes noise, not pattern.",
    ad_extraction_failed: (i: number, domain: string) => `Couldn't extract ad #${i + 1} (${domain}). Paste the copy or upload a screenshot.`,
    no_ads_extractable: "Couldn't extract any ad. Try pasting the copy or uploading screenshots.",
  },
  es: {
    insufficient_ads: "Manda al menos 3 anuncios — 1-2 no es muestra.",
    too_many_ads: "Máx 5 anuncios por análisis — más se vuelve ruido, no patrón.",
    ad_extraction_failed: (i: number, domain: string) => `No pude extraer el anuncio #${i + 1} (${domain}). Pega el copy o sube un screenshot.`,
    no_ads_extractable: "No pude extraer ningún anuncio. Intenta pegar el copy o subir screenshots.",
  },
};

function buildSystemPrompt(lang: "pt" | "en" | "es", platform: string, niche: string, accountCtx: string): string {
  const platformLabel = platform === "tiktok" ? "TikTok" : "Meta Ads (Facebook & Instagram)";
  const nicheLabel = niche ? ` no nicho "${niche}"` : "";

  if (lang === "en") {
    return `You are a senior media buyer with 15+ years analyzing competitor ads. Your job: take 3-5 real competitor ads from ${platformLabel}${nicheLabel ? ` in the "${niche}" niche` : ""} and extract the PATTERN — what they're all doing right (so user can match) and what NONE of them is doing (so user can attack the gap).

NEVER invent. Every claim about "top hook" or "common offer" must reference a SPECIFIC ad in the input by index (#1, #2, etc).

Be brutally specific. Generic phrases like "use emotion" or "leverage social proof" are forbidden. Instead: "Ad #1 opens with 'I lost 12kg' — specific number; Ad #3 opens with 'Doctors hate this' — vague claim. Specific numbers are winning here."

The GAP section is the most valuable output. Don't say "no one is using video" — say "all 5 ads are 30-60s editorial. NONE is sub-15s UGC. That's the gap."

Output ONLY valid JSON, no markdown:
{
  "summary": "1-sentence headline of what's happening in this niche right now",
  "top_hooks": [
    { "pattern": "specific hook pattern (e.g. 'numerical pain hook')", "example_quote": "exact opening line from one of the ads", "ad_ref": "#2", "why_it_works": "psychological mechanism — 1 sentence" }
  ],
  "format_dominant": { "format": "UGC|editorial|carousel|static|mixed", "duration_avg_seconds": 30, "evidence": "Ads #1, #3, #4 all match this — only #5 differs" },
  "tone_pattern": "1 sentence on dominant tone/style",
  "offers_pattern": [
    { "type": "discount|guarantee|urgency|free_trial|bonus|other", "example": "what's actually being offered, with ad ref" }
  ],
  "gap": {
    "headline": "the unexploited angle in 1 sentence — what NOBODY is doing",
    "why_no_one_does": "why might it be unused — risk, complexity, or just oversight",
    "evidence": "what's missing across the input"
  },
  "recommended_hooks": [
    { "hook": "exact opening line — what runs on screen / is said in first 3s", "type": "curiosity|social_proof|authority|contrast|story|outcome|question|relief", "why_for_this_user": "why this attacks the gap AND fits the user account ${accountCtx ? `(context: ${accountCtx})` : ""}", "platform_fit": "${platform}" }
  ],
  "confidence": "high|medium|low",
  "confidence_reason": "1 sentence on why — sample size, content quality, market knowledge"
}

5 recommended_hooks. Each must clearly attack the gap, not repeat what competitors are doing.`;
  }

  if (lang === "es") {
    return `Eres un media buyer senior con 15+ años analizando anuncios de la competencia. Tu trabajo: tomar 3-5 anuncios reales de competidores en ${platformLabel}${nicheLabel ? ` en el nicho "${niche}"` : ""} y extraer el PATRÓN — qué están haciendo todos bien y qué NADIE está haciendo (el gap).

NUNCA inventes. Toda afirmación sobre "top hook" debe referenciar un anuncio ESPECÍFICO por índice (#1, #2, etc).

Sé brutalmente específico. Frases genéricas como "usa emoción" están prohibidas. En su lugar: "Anuncio #1 abre con 'Perdí 12kg' — número específico; Anuncio #3 abre con 'Los médicos odian esto' — claim vago. Números específicos están ganando aquí."

La sección GAP es lo más valioso. No digas "nadie usa video" — di "los 5 anuncios son 30-60s editorial. NINGUNO es UGC sub-15s. Ese es el gap."

Devuelve SOLO JSON válido, sin markdown:
${jsonSchema(accountCtx, platform)}

5 recommended_hooks. Cada uno debe atacar el gap, no repetir lo que la competencia hace.`;
  }

  // pt (default)
  return `Você é um media buyer sênior com 15+ anos analisando anúncios de concorrentes. Sua missão: pegar 3-5 anúncios reais de concorrentes do ${platformLabel}${nicheLabel} e extrair o PADRÃO — o que TODOS estão fazendo certo (pra user igualar) e o que NINGUÉM está fazendo (pra user atacar o gap).

NUNCA invente. Toda afirmação sobre "top hook" ou "oferta comum" precisa referenciar um anúncio ESPECÍFICO do input por índice (#1, #2, etc).

Seja brutalmente específico. Frases genéricas tipo "usa emoção" ou "use prova social" estão PROIBIDAS. Em vez disso: "Anúncio #1 abre com 'Perdi 12kg' — número específico; Anúncio #3 abre com 'Médicos odeiam isso' — claim vago. Números específicos estão vencendo aqui."

A seção GAP é o output mais valioso. Não diz "ninguém usa vídeo" — diz "todos os 5 anúncios são 30-60s editorial. NENHUM é UGC sub-15s. Esse é o gap."

Devolva APENAS JSON válido, sem markdown:
${jsonSchema(accountCtx, platform)}

5 recommended_hooks. Cada um precisa CLARAMENTE atacar o gap, não repetir o que os concorrentes fazem.`;
}

function jsonSchema(accountCtx: string, platform: string): string {
  return `{
  "summary": "headline de 1 frase do que está rolando nesse nicho agora",
  "top_hooks": [
    { "pattern": "padrão de hook específico (ex: 'numerical pain hook')", "example_quote": "frase de abertura exata de um dos anúncios", "ad_ref": "#2", "why_it_works": "mecanismo psicológico — 1 frase" }
  ],
  "format_dominant": { "format": "UGC|editorial|carousel|static|mixed", "duration_avg_seconds": 30, "evidence": "Ads #1, #3, #4 batem — só #5 difere" },
  "tone_pattern": "1 frase sobre tom/estilo dominante",
  "offers_pattern": [
    { "type": "discount|guarantee|urgency|free_trial|bonus|other", "example": "o que realmente está sendo ofertado, com referência ao ad" }
  ],
  "gap": {
    "headline": "o ângulo inexplorado em 1 frase — o que NINGUÉM está fazendo",
    "why_no_one_does": "por que pode estar sem uso — risco, complexidade, ou só oversight",
    "evidence": "o que está faltando no conjunto"
  },
  "recommended_hooks": [
    { "hook": "frase de abertura exata — o que aparece na tela / é dito nos primeiros 3s", "type": "curiosity|social_proof|authority|contrast|story|outcome|question|relief", "why_for_this_user": "por que isso ataca o gap E serve a conta do user ${accountCtx ? `(contexto: ${accountCtx})` : ""}", "platform_fit": "${platform}" }
  ],
  "confidence": "high|medium|low",
  "confidence_reason": "1 frase sobre o porquê — sample size, qualidade dos dados, conhecimento de mercado"
}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Auth ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user: authUser } } = await sb.auth.getUser(authHeader.slice(7));
    if (!authUser) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Credits + cost cap ──────────────────────────────────────────────
    const creditCheck = await requireCredits(sb, authUser.id, "competitor");
    if (!creditCheck.allowed) {
      return new Response(JSON.stringify(creditCheck.error), {
        status: 402, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: planRow } = await sb.from("profiles").select("plan").eq("id", authUser.id).maybeSingle();
    const plan = (planRow as any)?.plan || "free";
    const cap = await checkCostCap(sb, authUser.id, plan);
    if (!cap.allowed) return capExceededResponse(cap, cors);

    // ── Body parse ──────────────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as Body;
    const { ads = [], niche = "", platform = "meta", ui_language = "pt", user_account_context = "" } = body;
    const lang = (["pt", "en", "es"].includes(ui_language) ? ui_language : "pt") as "pt" | "en" | "es";
    const i18n = I18N[lang];

    if (!Array.isArray(ads) || ads.length < 3) {
      return new Response(JSON.stringify({ error: "insufficient_ads", message: i18n.insufficient_ads }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (ads.length > 5) {
      return new Response(JSON.stringify({ error: "too_many_ads", message: i18n.too_many_ads }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Extract content from each ad ────────────────────────────────────
    const extracted: Array<{ index: number; type: "text" | "image"; content: string; image_b64?: string; image_mime?: string; failed?: boolean; failed_reason?: string }> = [];
    let imageCount = 0;

    for (let i = 0; i < ads.length; i++) {
      const ad = ads[i];
      if (ad.kind === "image" && ad.value) {
        extracted.push({ index: i, type: "image", content: `[AD #${i + 1} — screenshot uploaded]`, image_b64: ad.value, image_mime: ad.media_type || "image/jpeg" });
        imageCount++;
        continue;
      }
      if (ad.kind === "text" && ad.value?.trim()) {
        extracted.push({ index: i, type: "text", content: `[AD #${i + 1}]\n${ad.value.trim().slice(0, 2000)}` });
        continue;
      }
      if (ad.kind === "url" && ad.value) {
        const url = ad.value.trim();
        const result = await extractFromUrl(url);
        if (result.ok) {
          extracted.push({ index: i, type: "text", content: `[AD #${i + 1} — ${result.domain}]\n${result.content}` });
        } else {
          extracted.push({ index: i, type: "text", content: "", failed: true, failed_reason: i18n.ad_extraction_failed(i, result.domain) });
        }
        continue;
      }
      extracted.push({ index: i, type: "text", content: "", failed: true, failed_reason: i18n.ad_extraction_failed(i, "?") });
    }

    const usable = extracted.filter(e => !e.failed);
    const failures = extracted.filter(e => e.failed);
    if (usable.length < 3) {
      return new Response(JSON.stringify({
        error: "no_ads_extractable",
        message: i18n.no_ads_extractable,
        failures: failures.map(f => ({ index: f.index + 1, reason: f.failed_reason })),
      }), { status: 422, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── Build Claude payload ────────────────────────────────────────────
    // Vision needed if any ad is an image. Sonnet for vision, Haiku for text-only.
    const useVision = imageCount > 0;
    const model = useVision ? "claude-sonnet-4-20250514" : "claude-haiku-4-5-20251001";

    const systemPrompt = buildSystemPrompt(lang, platform, niche, user_account_context);

    // Compose user content: text snippets first, then images (if any)
    const userContent: any[] = [];
    const textBlock = usable
      .filter(u => u.type === "text")
      .map(u => u.content)
      .join("\n\n---\n\n");
    if (textBlock) {
      userContent.push({ type: "text", text: textBlock });
    }
    for (const u of usable) {
      if (u.type === "image" && u.image_b64) {
        userContent.push({
          type: "image",
          source: { type: "base64", media_type: u.image_mime || "image/jpeg", data: u.image_b64 },
        });
        userContent.push({ type: "text", text: `↑ AD #${u.index + 1}` });
      }
    }
    userContent.push({
      type: "text",
      text: `Total: ${usable.length} anúncios. Plataforma: ${platform}. ${niche ? `Nicho declarado: "${niche}". ` : ""}${user_account_context ? `Conta do user: ${user_account_context}. ` : ""}Devolve o JSON conforme schema. Seja específico. Cite exemplos por #ref.`,
    });

    log("calling Claude", { model, ads_count: usable.length, has_image: useVision, lang });

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        // System prompt cacheado — varia por idioma+platform+niche+accountCtx,
        // mas dentro de uma sessão de spy do mesmo user pra mesmo nicho hits
        // de cache batem direto.
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      log("anthropic error", { status: aiRes.status, body: errText.slice(0, 300) });
      return new Response(JSON.stringify({
        error: "ai_unavailable",
        message: lang === "en" ? "AI service unavailable. Try again in a moment." : lang === "es" ? "Servicio IA no disponible. Intenta en un momento." : "Serviço de IA indisponível. Tenta de novo em instantes.",
      }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();

    // Record cost — cap funciona pro próximo call
    try {
      const u = aiData?.usage || {};
      const inTok = Number(u.input_tokens || 0);
      const outTok = Number(u.output_tokens || 0);
      if (inTok || outTok) {
        recordCost(sb, authUser.id, aiData?.model || model, inTok, outTok).catch(() => {});
      }
    } catch (_) { /* non-fatal */ }

    const rawText = (aiData?.content?.[0]?.text || "").replace(/```json|```/g, "").trim();
    let analysis: any;
    try {
      // Tolerância a texto antes/depois do JSON
      const match = rawText.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(match ? match[0] : rawText);
    } catch (e) {
      log("JSON parse failed", { raw: rawText.slice(0, 300) });
      return new Response(JSON.stringify({
        error: "parse_failed",
        message: lang === "en" ? "AI returned malformed output. Try again." : lang === "es" ? "IA devolvió salida malformada. Intenta de nuevo." : "IA devolveu output inválido. Tenta de novo.",
        raw_preview: rawText.slice(0, 200),
      }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Save to learned_patterns for future reference (non-blocking)
    try {
      await sb.from("learned_patterns" as any).insert({
        user_id: authUser.id,
        pattern_key: `spy_${platform}_${(niche || "general").slice(0, 30).replace(/\s+/g, "_")}_${Date.now()}`,
        insight_text: analysis.summary || "",
        hook_type: "spy_intelligence",
        confidence: analysis.confidence === "high" ? 0.9 : analysis.confidence === "medium" ? 0.7 : 0.5,
        sample_size: usable.length,
        variables: { ...analysis, platform, niche, ad_count: usable.length, fetched_at: new Date().toISOString() },
        last_updated: new Date().toISOString(),
      });
    } catch (e) {
      log("learned_patterns insert failed (non-fatal)", { err: String(e).slice(0, 100) });
    }

    return new Response(JSON.stringify({
      ok: true,
      analysis,
      meta: {
        ads_processed: usable.length,
        ads_failed: failures.length,
        failures: failures.map(f => ({ index: f.index + 1, reason: f.failed_reason })),
        platform,
        niche,
        model_used: aiData?.model || model,
      },
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e) {
    log("unhandled error", { err: String(e).slice(0, 200) });
    return new Response(JSON.stringify({ error: "internal_error", message: String(e).slice(0, 200) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
