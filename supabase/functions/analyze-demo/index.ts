// analyze-demo v3 — public ad analysis for pre-signup demo
// Always returns 200 JSON so the client can read structured errors.

import { createClient } from "npm:@supabase/supabase-js@2";

type Analysis = {
  score?: number;
  verdict?: string;
  hook?: string;
  message?: string;
  cta?: string;
  actions?: string[];
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const log = (step: string, d?: unknown) =>
  console.log("[ANALYZE-DEMO] " + step + (d ? " — " + JSON.stringify(d) : ""));

const parseAnalysis = (rawText: string): Analysis => {
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Analysis;
      // Strip any emojis from verdict (model sometimes adds 🟢🟡🔴)
      const cleanVerdict = (parsed.verdict || "Test").replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/gu, "").trim();
      return {
        score: Number(parsed.score) || 0,
        verdict: cleanVerdict || "Test",
        hook: parsed.hook || "",
        message: parsed.message || "",
        cta: parsed.cta || "",
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      };
    }
  } catch {
    // fall through to fallback payload
  }

  return {
    score: 0,
    verdict: "Test",
    hook: rawText.slice(0, 200),
    message: "",
    cta: "",
    actions: [],
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const startedAt = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return json({ ok: false, error: "missing_api_key" });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: ipCount, error: countError } = await supabase
      .from("demo_leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("created_at", oneDayAgo);

    if (countError) {
      log("Rate limit count error", countError);
      return json({ ok: false, error: "rate_limit_check_failed" });
    }

    if ((ipCount ?? 0) >= 3) {
      return json({
        ok: false,
        error: "rate_limited",
        message: "You've reached the daily demo limit. Sign up for the 1-day free trial to continue!",
      });
    }

    const body = await req.json();
    const base64 = typeof body.image_base64 === "string" ? body.image_base64 : "";
    const mediaType = typeof body.media_type === "string" ? body.media_type : "image/jpeg";
    const email = typeof body.email === "string" ? body.email : null;
    const lang = body.lang === "pt" || body.lang === "es" ? body.lang : "en";

    if (!base64) {
      return json({ ok: false, error: "missing_image" });
    }

    log("Processing demo analysis", { email: email ? "provided" : "none", lang, ip });

    // System prompts — v4: separated positives/negatives, specific visual references, natural tone
    const systemPrompt = lang === "pt"
      ? `Voce e um gestor de trafego senior com 10+ anos em Meta Ads. Analise este criativo como se estivesse dando feedback para um colega — tom natural, direto, sem ser generico.

REGRAS IMPORTANTES:
- Descreva EXATAMENTE o que ve na imagem (produto, cores, texto, cenario, composicao). Nada generico.
- "hook" = SOMENTE o que funciona bem. Nenhuma critica aqui. Fale do que captura atencao e por que.
- "message" = SOMENTE o que precisa melhorar. Nenhum elogio aqui. Fale do que esta fraco e por que.
- Seja especifico: cite elementos visuais reais (cor, posicao, texto que aparece, produto).
- Tom: como um amigo que manja de ads dando feedback honesto. Natural, com alma.
- Nunca use emojis no JSON.

Formato: JSON puro com campos {score, verdict, hook, message, cta, actions}
- score: nota de 1-10
- verdict: "Escalar" | "Testar" | "Pausar" (sem emoji, sem prefixo)
- hook: 2-3 frases sobre o que FUNCIONA (visual, composicao, cor, produto em destaque)
- message: 2-3 frases sobre o que PRECISA MELHORAR (hierarquia, copy, CTA, clareza)
- cta: avaliacao do call-to-action em 1 frase
- actions: array de 3 melhorias especificas e acionaveis`

      : lang === "es"
      ? `Eres un media buyer senior con 10+ anos en Meta Ads. Analiza este creativo como si dieras feedback a un colega — tono natural, directo, sin ser generico.

REGLAS IMPORTANTES:
- Describe EXACTAMENTE lo que ves en la imagen (producto, colores, texto, escenario, composicion). Nada generico.
- "hook" = SOLO lo que funciona bien. Ninguna critica aqui. Habla de lo que captura atencion y por que.
- "message" = SOLO lo que necesita mejorar. Ningun elogio aqui. Habla de lo que esta debil y por que.
- Se especifico: menciona elementos visuales reales (color, posicion, texto visible, producto).
- Tono: como un amigo experto en ads dando feedback honesto. Natural, con alma.
- Nunca uses emojis en el JSON.

Formato: JSON puro con campos {score, verdict, hook, message, cta, actions}
- score: nota de 1-10
- verdict: "Escalar" | "Testear" | "Pausar" (sin emoji)
- hook: 2-3 frases sobre lo que FUNCIONA
- message: 2-3 frases sobre lo que NECESITA MEJORAR
- cta: evaluacion del call-to-action en 1 frase
- actions: array de 3 mejoras especificas y accionables`

      : `You are a senior media buyer with 10+ years in Meta Ads. Analyze this creative as if giving feedback to a colleague — natural tone, direct, never generic.

IMPORTANT RULES:
- Describe EXACTLY what you see in the image (product, colors, text, setting, composition). Nothing generic.
- "hook" = ONLY what works well. No criticism here. Talk about what grabs attention and why.
- "message" = ONLY what needs improving. No praise here. Talk about what's weak and why.
- Be specific: reference actual visual elements (color, position, visible text, product shown).
- Tone: like a friend who knows ads giving honest feedback. Natural, with soul.
- Never use emojis in the JSON.

Format: pure JSON with fields {score, verdict, hook, message, cta, actions}
- score: 1-10 rating
- verdict: "Scale" | "Test" | "Pause" (no emoji, no prefix)
- hook: 2-3 sentences about what WORKS (visual, composition, color, product showcase)
- message: 2-3 sentences about what NEEDS IMPROVING (hierarchy, copy, CTA, clarity)
- cta: call-to-action assessment in 1 sentence
- actions: array of 3 specific, actionable improvements`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: lang === "pt" ? "Analise este criativo de anuncio." : lang === "es" ? "Analiza este creativo de anuncio." : "Analyze this ad creative." },
          ],
        }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      log("Claude error", { status: claudeRes.status, err });
      return json({
        ok: false,
        error: "analysis_service_unavailable",
        diagnostics: {
          stage: "anthropic_request",
          status: claudeRes.status,
          processing_time_ms: Date.now() - startedAt,
        },
      });
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || "";
    const analysis = parseAnalysis(rawText);

    const { error: insertErr } = await supabase.from("demo_leads").insert({
      email,
      ip_address: ip,
      analysis_score: analysis.score || 0,
      analysis_result: analysis,
      lang,
    });
    if (insertErr) log("Insert error (non-blocking)", { error: JSON.stringify(insertErr) });

    const hasEmail = !!email;
    // Always return all fields — frontend controls visibility via "full" flag
    // This ensures localStorage has the complete analysis for post-signup injection
    const result = {
      ok: true,
      full: hasEmail,
      score: analysis.score,
      verdict: analysis.verdict,
      hook: analysis.hook,
      message: analysis.message,
      cta: analysis.cta,
      actions: analysis.actions || [],
    };

    log("Analysis complete", { score: analysis.score, verdict: analysis.verdict, hasEmail });
    return json(result);
  } catch (e) {
    log("ERROR", { error: String(e) });
    return json({
      ok: false,
      error: "service_failed",
      diagnostics: {
        processing_time_ms: Date.now() - startedAt,
      },
    });
  }
});
