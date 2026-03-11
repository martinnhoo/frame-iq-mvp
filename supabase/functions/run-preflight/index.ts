import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse request — supports both FormData (video/audio file) and JSON (script text) ──
    let script = "";
    let hook = "";
    let cta = "";
    let platform = "tiktok";
    let market = "BR";
    let duration = "30";
    let format = "UGC";
    let product = "";
    let compliance_notes = "";
    let user_id = "";
    let funnel_stage = "tofu";
    let persona_context: Record<string, unknown> | null = null;
    let transcribed_from_video = false;
    let video_filename = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const videoFile = formData.get("video_file") as File | null;
      platform = (formData.get("platform") as string) || "tiktok";
      market = (formData.get("market") as string) || "BR";
      duration = (formData.get("duration") as string) || "30";
      format = (formData.get("format") as string) || "UGC";
      product = (formData.get("product") as string) || "";
      compliance_notes = (formData.get("compliance_notes") as string) || "";
      user_id = (formData.get("user_id") as string) || "";
      funnel_stage = (formData.get("funnel_stage") as string) || "tofu";
      const pcStr = formData.get("persona_context") as string | null;
      if (pcStr) { try { persona_context = JSON.parse(pcStr); } catch {} }
      hook = (formData.get("hook") as string) || "";
      cta = (formData.get("cta") as string) || "";

      if (videoFile && OPENAI_API_KEY) {
        video_filename = videoFile.name || "audio.wav";
        console.log("Transcribing with Whisper:", video_filename, videoFile.size);
        const whisperForm = new FormData();
        whisperForm.append("file", videoFile, video_filename);
        whisperForm.append("model", "whisper-1");
        whisperForm.append("response_format", "verbose_json");

        const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
          body: whisperForm,
        });

        if (whisperRes.ok) {
          const whisperData = await whisperRes.json();
          script = whisperData.text || "";
          if (whisperData.duration) duration = String(Math.round(whisperData.duration));
          transcribed_from_video = true;
          console.log("Whisper OK, transcript length:", script.length, "duration:", duration);
        } else {
          const errText = await whisperRes.text();
          console.error("Whisper error:", whisperRes.status, errText);
          return new Response(JSON.stringify({ error: "Audio transcription failed: " + errText }), {
            status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (videoFile && !OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: "OPENAI_API_KEY required for video transcription" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const body = await req.json();
      script = body.script || "";
      hook = body.hook || "";
      cta = body.cta || "";
      platform = body.platform || "tiktok";
      market = body.market || "BR";
      duration = body.duration || "30";
      format = body.format || "UGC";
      product = body.product || "";
      compliance_notes = body.compliance_notes || "";
      user_id = body.user_id || "";
      funnel_stage = body.funnel_stage || "tofu";
      persona_context = body.persona_context || null;
    }

    if (!script.trim()) {
      return new Response(JSON.stringify({ error: "No script or audio found to analyze" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load user AI profile for context ──
    let userContext = "";
    if (user_id) {
      const { data: profile } = await supabase
        .from("user_ai_profile")
        .select("avg_hook_score, top_performing_hooks, best_platforms, ai_recommendations")
        .eq("user_id", user_id)
        .maybeSingle();
      if (profile) {
        userContext = `\nUSER CREATIVE PROFILE: Avg hook score=${profile.avg_hook_score}/10, Best hook types=${(profile.top_performing_hooks || []).join(", ")}, Best platforms=${(profile.best_platforms || []).join(", ")}`;
      }
    }

    // ── Platform + Market rules ──
    const platformRules: Record<string, string> = {
      tiktok: "Max 60s ideal (15s hook), 9:16 vertical, no watermarks, captions recommended, no direct gambling CTAs, avoid 'click link' — say 'check bio'",
      reels: "Max 60s (90s allowed), 9:16, no political content, no before/after body, captions recommended, music must be licensed",
      facebook: "Can be 1:1 or 16:9 or 9:16, max 20% text in thumbnail, no shocking language, financial claims need disclaimers",
      youtube_shorts: "Max 60s, 9:16, no misleading thumbnails, age-gating for gambling, no deceptive CTAs",
      google_uac: "No gambling unless licensed, no before/after, no health claims without substantiation",
    };

    const marketRules: Record<string, string> = {
      BR: "Use 'autorizado' not 'legalizado'. Jogo responsável required. Avoid 'não perca tempo'. CTA: 'Jogue agora'. LGPD compliance. No minors.",
      MX: "iGaming grey area — avoid direct gambling language. Use 'entretenimento'/'entretenimiento' framing. No direct payout promises.",
      IN: "Skill gaming allowed, chance-based restricted. Avoid 'gambling', use 'skill game'. 18+ disclaimer required.",
      US: "State-by-state laws. Licensed states only. Problem gambling hotline required for some states.",
      GB: "UKGC licensed only. 'When the fun stops, stop' required. No celebrity appeal to minors.",
      AR: "Limited regulation — avoid absolute payout claims. Age 18+ required.",
      CO: "Regulated market — Coljuegos approval. Responsible gaming messages required.",
      GLOBAL: "Apply most restrictive standard. Age 18+ universal.",
    };

    const platformRule = platformRules[platform] || platformRules["tiktok"];
    const marketRule = marketRules[market] || marketRules["GLOBAL"];

    const prompt = `You are a senior performance creative director and compliance specialist. Do a complete pre-flight check on this ad script.

${transcribed_from_video ? `SOURCE: Transcribed from video file "${video_filename}" using Whisper AI. The transcript may be imperfect — account for this in your analysis.\n` : ""}
SCRIPT:
\`\`\`
${script}
\`\`\`

CONTEXT:
- Hook (0-3s): ${hook || "extract from script"}
- CTA: ${cta || "extract from script"}
- Platform: ${platform}
- Market: ${market}
- Duration: ${duration}s
- Format: ${format}
- Product: ${product || "not specified"}
- Funnel Stage: ${funnel_stage.toUpperCase()} (${funnel_stage === "tofu" ? "Cold audience — awareness, pattern interrupt priority" : funnel_stage === "mofu" ? "Warm audience — consideration, proof and differentiation" : "Hot audience — conversion, urgency and CTA clarity"})
- User compliance notes: ${compliance_notes || "none"}
- Transcribed from video: ${transcribed_from_video}
${persona_context ? `\nTARGET PERSONA: ${persona_context.name || ""} — Age ${persona_context.age_range || "unknown"}, ${persona_context.platforms?.join(", ") || "unknown platforms"}. Pain points: ${(persona_context.pain_points as string[] || []).join(", ")}. Interests: ${(persona_context.interests as string[] || []).join(", ")}. Apply persona lens to all assessments.` : ""}

PLATFORM RULES (${platform.toUpperCase()}): ${platformRule}
MARKET RULES (${market}): ${marketRule}
${userContext}

Return ONLY valid JSON (no markdown, no backticks):
{
  "score": <0-100 overall readiness>,
  "verdict": "READY" | "REVIEW" | "BLOCKED",
  "verdict_reason": "<one sentence>",
  "transcription_note": ${transcribed_from_video ? '"Script was auto-transcribed from video audio via Whisper. Review for accuracy before finalizing."' : 'null'},
  "hook_analysis": {
    "text": "<extracted 0-3s hook>",
    "type": "<curiosity|social_proof|direct|pain|shock|question|stat>",
    "score": <1-10>,
    "status": "STRONG|SOLID|REVIEW|WEAK|CRITICAL",
    "detail": "<specific feedback>",
    "rewrite": "<stronger hook if score < 7, else null>"
  },
  "structure": [
    { "segment": "Hook (0-3s)",    "status": "STRONG|SOLID|REVIEW|WEAK|CRITICAL", "detail": "<assessment>" },
    { "segment": "Build (3-15s)",  "status": "STRONG|SOLID|REVIEW|WEAK|CRITICAL", "detail": "<assessment>" },
    { "segment": "Proof (15-25s)", "status": "STRONG|SOLID|REVIEW|WEAK|CRITICAL", "detail": "<assessment>" },
    { "segment": "CTA (last 5s)",  "status": "STRONG|SOLID|REVIEW|WEAK|CRITICAL", "detail": "<CTA assessment>" }
  ],
  "compliance": [
    { "rule": "<rule name>", "status": "CLEAR|REVIEW|BLOCKED", "detail": "<specific finding>" }
  ],
  "platform_fit": {
    "primary": { "platform": "${platform}", "status": "OPTIMAL|GOOD|REVIEW|POOR", "detail": "<assessment>" },
    "crosspost": [
      { "platform": "<name>", "status": "OPTIMAL|GOOD|REVIEW|POOR", "detail": "<note>" }
    ]
  },
  "language_check": {
    "status": "CLEAR|REVIEW|ERROR",
    "issues": [
      { "found": "<word/phrase>", "issue": "<problem>", "fix": "<replacement>" }
    ]
  },
  "cta_check": {
    "text": "<extracted CTA>",
    "status": "STRONG|REVIEW|WEAK",
    "platform_compliant": true,
    "detail": "<assessment>",
    "suggestion": "<better CTA if needed, else null>"
  },
  "top_fixes": ["<specific fix 1>", "<specific fix 2>", "<specific fix 3>"],
  "strengths": ["<strength 1>", "<strength 2>"],
  "estimated_hook_score": <1-10>,
  "word_count": <number>,
  "reading_time_seconds": <estimated VO seconds>
}`;

    // Rate limit check
    if (user_id) {
      const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user_id).single();
      const { data: rateCheck } = await supabase.rpc("check_and_increment_ai_usage", { p_user_id: user_id, p_plan: profile?.plan || "free" });
      if (rateCheck && !rateCheck.allowed) {
        return new Response(JSON.stringify({ error: rateCheck.message, daily_limit: true }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("Calling AI for pre-flight analysis...");
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      throw new Error(`AI analysis error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const rawText = aiData.choices?.[0]?.message?.content || "{}";
    const clean = rawText.replace(/```json|```/g, "").trim();
    console.log("AI response length:", clean.length);
    const result = JSON.parse(clean);

    // ── Track usage (non-blocking) ──
    if (user_id) {
      const currentPeriod = new Date().toISOString().slice(0, 7);
      const { data: currentUsage } = await supabase
        .from("usage")
        .select("preflights_count")
        .eq("user_id", user_id)
        .eq("period", currentPeriod)
        .single();

      if (currentUsage) {
        await supabase.from("usage").update({
          preflights_count: ((currentUsage as any).preflights_count || 0) + 1,
        }).eq("user_id", user_id).eq("period", currentPeriod);
      } else {
        await supabase.from("usage").insert({
          user_id,
          period: currentPeriod,
          preflights_count: 1,
        });
      }
    }

    return new Response(JSON.stringify({ ...result, transcribed_from_video, video_filename, transcript: transcribed_from_video ? script : undefined }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("run-preflight error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
