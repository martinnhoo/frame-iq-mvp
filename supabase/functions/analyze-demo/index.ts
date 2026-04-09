// analyze-demo v2 — public ad analysis for pre-signup demo
// No auth required. Returns partial analysis (teaser).
// Full analysis requires email capture → stored in demo_leads table.
// Rate limited: 3 analyses per IP per day.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, d?: unknown) =>
  console.log("[ANALYZE-DEMO] " + step + (d ? " — " + JSON.stringify(d) : ""));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

    // ── Rate limit by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: ipCount } = await supabase
      .from("demo_leads")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("created_at", oneDayAgo);

    if ((ipCount ?? 0) >= 3) {
      return new Response(JSON.stringify({
        error: "rate_limited",
        message: "You've reached the daily demo limit. Sign up for free to continue!",
      }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ── Parse body (JSON with base64)
    const body = await req.json();
    const base64 = body.image_base64;
    const mediaType = body.media_type || "image/jpeg";
    const email = body.email || null;
    const lang = body.lang || "en";

    if (!base64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    log("Processing demo analysis", { email: email ? "provided" : "none", lang, ip });

    // ── Call Claude Haiku for fast analysis
    const systemPrompt = lang === "pt"
      ? "Voce e um especialista em performance de Meta Ads. Analise este criativo de anuncio e forneca:\n1. SCORE: nota de 1-10\n2. VEREDICTO: \uD83D\uDFE2 Escalar | \uD83D\uDFE1 Testar | \uD83D\uDD34 Pausar\n3. HOOK VISUAL: avaliacao do primeiro frame / imagem principal (1 frase)\n4. MENSAGEM: clareza da proposta de valor (1 frase)\n5. CTA: avaliacao do call-to-action (1 frase)\n6. TOP 3 ACOES: 3 melhorias especificas e acionaveis\n\nFormato: JSON com campos {score, verdict, hook, message, cta, actions: string[]}"
      : lang === "es"
      ? "Eres un especialista en performance de Meta Ads. Analiza este creativo y proporciona:\n1. SCORE: nota de 1-10\n2. VEREDICTO: \uD83D\uDFE2 Escalar | \uD83D\uDFE1 Testear | \uD83D\uDD34 Pausar\n3. HOOK VISUAL: evaluacion del primer frame (1 frase)\n4. MENSAJE: claridad de la propuesta de valor (1 frase)\n5. CTA: evaluacion del call-to-action (1 frase)\n6. TOP 3 ACCIONES: 3 mejoras especificas y accionables\n\nFormato: JSON con campos {score, verdict, hook, message, cta, actions: string[]}"
      : "You are a Meta Ads performance specialist. Analyze this ad creative and provide:\n1. SCORE: 1-10 rating\n2. VERDICT: \uD83D\uDFE2 Scale | \uD83D\uDFE1 Test | \uD83D\uDD34 Pause\n3. VISUAL HOOK: assessment of the main image/first frame (1 sentence)\n4. MESSAGE: value proposition clarity (1 sentence)\n5. CTA: call-to-action assessment (1 sentence)\n6. TOP 3 ACTIONS: 3 specific, actionable improvements\n\nFormat: JSON with fields {score, verdict, hook, message, cta, actions: string[]}";

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
      throw new Error("Claude API error: " + claudeRes.status);
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || "";

    // ── Parse JSON from Claude response
    let analysis: Record<string, unknown> = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
    } catch {
      analysis = { score: 0, verdict: "\uD83D\uDFE1 Test", hook: rawText.slice(0, 200), message: "", cta: "", actions: [] };
    }

    // ── Store lead + analysis
    const { error: insertErr } = await supabase.from("demo_leads").insert({
      email: email || null,
      ip_address: ip,
      analysis_score: (analysis.score as number) || 0,
      analysis_result: analysis,
      lang,
    });
    if (insertErr) log("Insert error (non-blocking)", { error: JSON.stringify(insertErr) });

    // ── Return result
    const hasEmail = !!email;
    const result = hasEmail
      ? {
          full: true,
          score: analysis.score,
          verdict: analysis.verdict,
          hook: analysis.hook,
          message: analysis.message,
          cta: analysis.cta,
          actions: (analysis.actions as string[]) || [],
        }
      : {
          full: false,
          score: analysis.score,
          verdict: analysis.verdict,
          hook: analysis.hook,
        };

    log("Analysis complete", { score: analysis.score, verdict: analysis.verdict, hasEmail });

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    log("ERROR", { error: String(e) });
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
