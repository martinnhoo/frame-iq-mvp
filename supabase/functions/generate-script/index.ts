import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VO_LANG: Record<string, string> = {
  BR: "Brazilian Portuguese", MX: "Mexican Spanish",
  US: "English", IN: "English (Indian market)",
  GLOBAL: "English",
};

const FORMAT_GUIDE: Record<string, string> = {
  ugc:          "User-generated style. Casual, first person, feels authentic and unpolished. Like a real person sharing their experience. No corporate language.",
  vsl:          "Video sales letter. Direct response. Problem → Agitate → Solution → Proof → CTA. Every line earns the next.",
  talking_head: "Direct to camera. Educational or authority positioning. Clear, confident, structured. Can include personal story or insight.",
  hook_only:    "Only the first 3–5 seconds. Pattern interrupt that stops the scroll. No need to resolve — just hook hard.",
  product_demo: "Show the product. Feature → Benefit → Proof. Visual-led. VO supports what's on screen.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { product, offer, audience, format, duration, market, angle, extra_context, user_id } = await req.json();
    // ── Plan gate — verify server-side, cannot be bypassed via frontend ──────
    if (user_id) {
      const { data: prof } = await supabase.from('profiles').select('plan').eq('id', user_id).maybeSingle();
      const plan = prof?.plan || 'free';
      const allowed = ['maker','pro','studio','creator','starter','scale'].includes(plan);
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'plan_required', message: 'This tool requires a paid plan.' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }


    if (!product) return new Response(JSON.stringify({ error: "Missing product" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    // Fetch accumulated creative context from the loop
    let loopContext = "";
    if (user_id) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const loopRes = await fetch(`${supabaseUrl}/functions/v1/creative-loop`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
          },
          body: JSON.stringify({ action: "get_context", user_id }),
        });
        if (loopRes.ok) {
          const loopData = await loopRes.json();
          if (loopData.has_data && loopData.context) {
            loopContext = `\n\n--- ACCOUNT CREATIVE INTELLIGENCE (learned from this client's real ad data) ---\n${loopData.context}\n--- Use these insights to write scripts that align with proven winning patterns. ---`;
          }
        }
      } catch { /* loop context is optional */ }
    }

    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });

    const systemPrompt = `You are a senior performance creative director with 12 years writing scripts for paid social — iGaming, DTC, fintech, apps. Your scripts consistently outperform AI-generated content because they feel human, specific, and platform-native.

Script output format:
- VO (voiceover): written in the target language — natural spoken rhythm, not written prose
- ON-SCREEN: short text overlays, punchy, 1–5 words max each
- VISUAL: production notes in English — what the editor should show, transitions, pacing cues

Rules you never break:
- VO must sound like a real human speaking, not reading
- No buzzwords: "unlock", "elevate", "transform", "game-changer", "delve", "innovative"
- Respect the format guide exactly
- Visual notes always in English regardless of market
- Each of the 3 scripts must have a completely different hook angle and rhythm
- Compliance: if market is BR and product is iGaming, use "autorizado" not "legalizado", CTA "Jogue agora"`;

    const userPrompt = `Generate 3 distinct script variations for:

Product: ${product}
${offer ? `Offer/CTA: ${offer}` : ""}
${audience ? `Target audience: ${audience}` : ""}
Format: ${format} — ${FORMAT_GUIDE[format] || format}
Duration: ${duration}
Market: ${market} (VO language: ${VO_LANG[market] || "English"})
Creative angle: ${angle}
${extra_context ? `Extra context: ${extra_context}` : ""}
${loopContext}

Return ONLY a JSON object — no markdown, no explanation:
{
  "scripts": [
    {
      "title": "Script title (5 words max)",
      "duration": "${duration}",
      "format": "${format}",
      "hook_score": 0-100,
      "lines": [
        {"type": "vo", "text": "..."},
        {"type": "onscreen", "text": "..."},
        {"type": "visual", "text": "..."}
      ],
      "notes": "Director notes for editor"
    }
  ]
}

Each script needs 8–15 lines alternating VO/on-screen/visual. Vary the angle dramatically between the 3 scripts.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    let result;
    try {
      result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("generate-script error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
