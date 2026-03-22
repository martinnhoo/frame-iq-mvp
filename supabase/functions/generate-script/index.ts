import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Auth header verification (prevents user_id spoofing) ────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: { user: authUser } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!authUser) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const verified_user_id = authUser.id;
    // ─────────────────────────────────────────────────────────────────────────
    const { product, offer, audience, format, duration, market, angle, extra_context, user_id } = await req.json();
    const effectiveUserId = verified_user_id;

    // ── Plan gate — verify server-side, cannot be bypassed via frontend ──────
    if (effectiveUserId) {
      const { data: prof } = await supabase.from('profiles').select('plan').eq('id', effectiveUserId).maybeSingle();
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

    // ── Load full account intelligence in parallel ──────────────────────────
    let loopContext = "";
    if (effectiveUserId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const restHeaders = { apikey: svcKey, Authorization: `Bearer ${svcKey}` };
      try {
        const [profileRes, snapshotRes, loopFetch] = await Promise.allSettled([
          fetch(`${supabaseUrl}/rest/v1/user_ai_profile?user_id=eq.${effectiveUserId}&select=industry,pain_point,avg_hook_score,creative_style,top_performing_models`, { headers: restHeaders }),
          fetch(`${supabaseUrl}/rest/v1/daily_snapshots?user_id=eq.${effectiveUserId}&select=date,avg_ctr,total_spend,top_ads,ai_insight&order=date.desc&limit=1`, { headers: restHeaders }),
          fetch(`${supabaseUrl}/functions/v1/creative-loop`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${svcKey}` },
            body: JSON.stringify({ action: "get_context", user_id: effectiveUserId }),
          }),
        ]);

        if (profileRes.status === "fulfilled" && profileRes.value.ok) {
          const profiles = await profileRes.value.json();
          const p = Array.isArray(profiles) ? profiles[0] : profiles;
          if (p) {
            const rawNotes = (p.pain_point || "") as string;
            const instructions = rawNotes.split("|||").filter((s: string) => !s.startsWith("Usuário:") && !s.startsWith("Nicho:") && s.trim()).join(" | ");
            loopContext += `\n\n=== ACCOUNT PROFILE ===`;
            if (p.industry) loopContext += `\nIndustry: ${p.industry}`;
            if (p.creative_style) loopContext += `\nCreative style: ${p.creative_style}`;
            if (p.avg_hook_score) loopContext += `\nAvg hook score: ${p.avg_hook_score}/10`;
            if (instructions) loopContext += `\nPermanent instructions: ${instructions}`;
          }
        }
        if (snapshotRes.status === "fulfilled" && snapshotRes.value.ok) {
          const snaps = await snapshotRes.value.json();
          const s = Array.isArray(snaps) ? snaps[0] : snaps;
          if (s) {
            const top = ((s.top_ads as any[]) || []).filter((a: any) => a.isScalable || (a.ctr > 0.02)).slice(0, 3);
            loopContext += `\n\n=== META ADS CONTEXT (${s.date}) ===`;
            loopContext += `\nAccount CTR: ${((s.avg_ctr||0)*100).toFixed(2)}% | Spend: $${(s.total_spend||0).toFixed(0)}`;
            if (top.length) loopContext += `\nTop ads: ${top.map((a: any) => `"${a.name}" CTR ${((a.ctr||0)*100).toFixed(2)}%`).join(" | ")}`;
            if (s.ai_insight) loopContext += `\nInsight: ${s.ai_insight}`;
          }
        }
        if (loopFetch.status === "fulfilled" && loopFetch.value.ok) {
          const loopData = await loopFetch.value.json();
          if (loopData.has_data && loopData.context) {
            loopContext += `\n\n=== PROVEN CREATIVE PATTERNS ===\n${loopData.context}\n=== Use winning patterns to write scripts. ===`;
          }
        }
      } catch { /* context is optional */ }
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `Claude API error: ${response.status}`, details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseData = await response.json();
    const raw = responseData.content?.[0]?.type === "text" ? responseData.content[0].text : "{}";
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
