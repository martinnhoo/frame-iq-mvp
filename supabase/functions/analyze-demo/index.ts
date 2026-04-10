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
      return {
        score: Number(parsed.score) || 0,
        verdict: parsed.verdict || "Test",
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

    const systemPrompt = lang === "pt"
      ? "Voce e um especialista em performance de Meta Ads. Analise este criativo de anuncio e forneca:\n1. SCORE: nota de 1-10\n2. VEREDICTO: Escalar | Testar | Pausar\n3. HOOK VISUAL: avaliacao do primeiro frame / imagem principal (1 frase)\n4. MENSAGEM: clareza da proposta de valor (1 frase)\n5. CTA: avaliacao do call-to-action (1 frase)\n6. TOP 3 ACOES: 3 melhorias especificas e acionaveis\n\nFormato: JSON com campos {score, verdict, hook, message, cta, actions: string[]}"
      : lang === "es"
      ? "Eres un especialista en performance de Meta Ads. Analiza este creativo y proporciona:\n1. SCORE: nota de 1-10\n2. VEREDICTO: Escalar | Testear | Pausar\n3. HOOK VISUAL: evaluacion del primer frame (1 frase)\n4. MENSAJE: claridad de la propuesta de valor (1 frase)\n5. CTA: evaluacion del call-to-action (1 frase)\n6. TOP 3 ACCIONES: 3 mejoras especificas y accionables\n\nFormato: JSON con campos {score, verdict, hook, message, cta, actions: string[]}"
      : "You are a Meta Ads performance specialist. Analyze this ad creative and provide:\n1. SCORE: 1-10 rating\n2. VERDICT: Scale | Test | Pause\n3. VISUAL HOOK: assessment of the main image/first frame (1 sentence)\n4. MESSAGE: value proposition clarity (1 sentence)\n5. CTA: call-to-action assessment (1 sentence)\n6. TOP 3 ACTIONS: 3 specific, actionable improvements\n\nFormat: JSON with fields {score, verdict, hook, message, cta, actions: string[]}";

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
    const result = hasEmail
      ? {
          ok: true,
          full: true,
          score: analysis.score,
          verdict: analysis.verdict,
          hook: analysis.hook,
          message: analysis.message,
          cta: analysis.cta,
          actions: analysis.actions || [],
        }
      : {
          ok: true,
          full: false,
          score: analysis.score,
          verdict: analysis.verdict,
          hook: analysis.hook,
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
