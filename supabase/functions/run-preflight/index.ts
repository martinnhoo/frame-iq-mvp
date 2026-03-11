import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 503, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Parse request — supports both FormData (video file) and JSON (script text) ──
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
    let transcribed_from_video = false;
    let video_filename = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // Video file upload
      const formData = await req.formData();
      const videoFile = formData.get("video_file") as File | null;
      platform = (formData.get("platform") as string) || "tiktok";
      market = (formData.get("market") as string) || "BR";
      duration = (formData.get("duration") as string) || "30";
      format = (formData.get("format") as string) || "UGC";
      product = (formData.get("product") as string) || "";
      compliance_notes = (formData.get("compliance_notes") as string) || "";
      user_id = (formData.get("user_id") as string) || "";
      hook = (formData.get("hook") as string) || "";
      cta = (formData.get("cta") as string) || "";

      if (videoFile && OPENAI_API_KEY) {
        // Transcribe with Whisper
        video_filename = videoFile.name || "video.mp4";
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
          // Try to get duration from Whisper
          if (whisperData.duration) duration = String(Math.round(whisperData.duration));
          transcribed_from_video = true;
        } else {
          return new Response(JSON.stringify({ error: "Whisper transcription failed. Add OPENAI_API_KEY to Supabase secrets." }), {
            status: 503, headers: { ...cors, "Content-Type": "application/json" },
          });
        }
      } else if (videoFile && !OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: "OPENAI_API_KEY required for video transcription. Add it to Supabase secrets." }), {
          status: 503, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    } else {
      // JSON body — script text mode
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
    }

    if (!script.trim()) {
      return new Response(JSON.stringify({ error: "No script or audio found to analyze" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Load user AI profile for context ──
    let userContext = "";
    if (user_id) {
      const { data: profile } = await supabase
        .from("user_ai_profile")
        .select("creative_style, avg_hook_score, top_performing_hooks, best_platforms, ai_recommendations")
        .eq("user_id", user_id)
        .maybeSingle();
      if (profile) {
        userContext = `\nUSER CREATIVE PROFILE: Style=${profile.creative_style || "unknown"}, Avg hook score=${profile.avg_hook_score}/10, Best hook types=${(profile.top_performing_hooks || []).join(", ")}, Best platforms=${(profile.best_platforms || []).join(", ")}`;
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
- User compliance notes: ${compliance_notes || "none"}
- Transcribed from video: ${transcribed_from_video}

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

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2500, messages: [{ role: "user", content: prompt }] }),
    });

    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);

    const claudeData = await res.json();
    const raw = (claudeData.content?.[0]?.text || "").replace(/```json|```/g, "").trim();
    const result = JSON.parse(raw);

    // ── Save to preflight_checks ──
    if (user_id) {
      await supabase.from("preflight_checks").insert({
        user_id,
        script: script.substring(0, 2000),
        platform,
        market,
        format,
        product,
        score: result.score,
        verdict: result.verdict,
        hook_score: result.estimated_hook_score,
        result,
        created_at: new Date().toISOString(),
      }).select().single();

      // Non-blocking profile update
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/update-ai-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
        body: JSON.stringify({ user_id, trigger: "preflight" }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ...result, transcribed_from_video, video_filename }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("run-preflight error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
