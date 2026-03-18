import { createClient } from "npm:@supabase/supabase-js@2";

// ── Cost-based progressive throttle ──────────────────────────────────────────
const _COST_PER = { analysis:(3000/1e6*3)+(800/1e6*15), board:(2500/1e6*3)+(700/1e6*15), preflight:(2000/1e6*3)+(600/1e6*15), translation:(800/1e6*3)+(400/1e6*15), hook:(1500/1e6*3)+(400/1e6*15) };
const _PLAN_REV: Record<string,number> = { free:0, maker:19, pro:49, studio:149 };
async function checkThrottle(sb: ReturnType<typeof createClient>, uid: string): Promise<{allowed:boolean;retry_after:number}> {
  const period = new Date().toISOString().slice(0,7);
  const [{data:prof},{data:usage}] = await Promise.all([
    sb.from('profiles').select('plan,last_ai_action_at').eq('id',uid).single(),
    sb.from('usage').select('analyses_count,boards_count,translations_count,preflights_count,hooks_count').eq('user_id',uid).eq('period',period).single(),
  ]);
  const rev = _PLAN_REV[prof?.plan||'free']??0;
  if(rev<=0) return {allowed:true,retry_after:0};
  const cost=(usage?.analyses_count||0)*_COST_PER.analysis+(usage?.boards_count||0)*_COST_PER.board+(usage?.translations_count||0)*_COST_PER.translation+(usage?.preflights_count||0)*_COST_PER.preflight+(usage?.hooks_count||0)*_COST_PER.hook;
  const ratio=cost/rev;
  if(ratio<0.80) return {allowed:true,retry_after:0};
  const maxSec=480;
  const cooldown=ratio>=1?maxSec:Math.round(((ratio-0.80)/0.20)*maxSec);
  const elapsed=prof?.last_ai_action_at?(Date.now()-new Date(prof.last_ai_action_at).getTime())/1000:cooldown+1;
  const wait=Math.max(0,Math.ceil(cooldown-elapsed));
  if(wait>0) return {allowed:false,retry_after:wait};
  await sb.from('profiles').update({last_ai_action_at:new Date().toISOString()}).eq('id',uid);
  return {allowed:true,retry_after:0};
}
// ─────────────────────────────────────────────────────────────────────────────


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
    // Market rules only if user explicitly provided compliance notes
    const marketRule = compliance_notes
      ? `User-provided compliance notes: ${compliance_notes}`
      : marketRules[market] || marketRules["GLOBAL"];

    const prompt = `You are a friendly, experienced performance creative director reviewing an ad script before production. Your role is to help, not to block — think of yourself as a creative partner giving honest, constructive notes. Celebrate what works. Fix what doesn't.

TONE RULES (follow strictly):
- Be encouraging, specific, and constructive. Never harsh or alarmist.
- Only use BLOCKED for genuine hard violations (illegal claims, explicit content, hate speech). Everything else gets suggestions.
- The default verdict is READY or REVIEW. BLOCKED is rare.
- Compliance = only the selected platform's ad policies. Do NOT invent industry-specific regulations unless explicitly stated in user compliance notes.
- For every weakness, give a concrete actionable fix written in the same language as the script.
- Lead with strengths. Then suggest improvements.
- Assume good faith — ambiguous content gets charitable interpretation + a friendly suggestion.

${transcribed_from_video ? `SOURCE: Transcribed from video "${video_filename}" via Whisper AI. Minor inaccuracies possible — be lenient.\n` : ""}
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
- Funnel Stage: ${funnel_stage.toUpperCase()} (${funnel_stage === "tofu" ? "Cold audience — hook and pattern interrupt are the priority" : funnel_stage === "mofu" ? "Warm audience — proof and trust signals matter most" : "Hot audience — offer clarity and CTA urgency are key"})
${compliance_notes ? `- Compliance notes: ${compliance_notes}` : ""}
${persona_context ? `\nTARGET PERSONA: ${persona_context.name || ""} — Age ${(persona_context as Record<string, unknown>).age_range || "unknown"}, platforms: ${((persona_context as Record<string, unknown>).platforms as string[] || []).join(", ")}. Pain points: ${((persona_context as Record<string, unknown>).pain_points as string[] || []).join(", ")}. Use this as the lens for hook and copy assessment.` : ""}

PLATFORM GUIDELINES (${platform.toUpperCase()} only):
${platformRule}
${compliance_notes ? `\nUSER COMPLIANCE CONTEXT:\n${marketRule}` : ""}
${userContext}

SCORING:
- 80-100: Ship it. Minor polish at most.
- 60-79: Good bones, 1-2 things to fix before production.
- 40-59: Strong concept, specific rewrite needed on key elements.
- <40: Rethink the angle — but always give a constructive direction.

VERDICT RULES:
- READY: score ≥ 70, no hard platform violations
- REVIEW: score 40-69 OR has fixable issues worth addressing
- BLOCKED: ONLY for content violating platform terms so severely it would be rejected (explicit, hate, illegal). NOT for weak copy.

Return ONLY valid JSON (no markdown, no backticks):
{
  "score": <0-100>,
  "verdict": "READY" | "REVIEW" | "BLOCKED",
  "verdict_reason": "<one sentence focusing on the main opportunity, not the problem>",
  "transcription_note": ${transcribed_from_video ? '"Auto-transcribed — review for accuracy before finalizing."' : 'null'},
  "hook_analysis": {
    "text": "<extracted 0-3s hook>",
    "type": "<curiosity|social_proof|direct|pain|shock|question|stat>",
    "score": <1-10>,
    "status": "STRONG|SOLID|NEEDS_WORK",
    "detail": "<specific friendly feedback — what works and why, or what to try>",
    "rewrite": "<stronger hook in the same language as the script, if score < 7 — otherwise null>"
  },
  "structure": [
    { "segment": "Hook (0-3s)",    "status": "STRONG|SOLID|NEEDS_WORK", "detail": "<what works or a specific improvement>" },
    { "segment": "Build (3-15s)",  "status": "STRONG|SOLID|NEEDS_WORK", "detail": "<assessment + suggestion if needed>" },
    { "segment": "Proof (15-25s)", "status": "STRONG|SOLID|NEEDS_WORK", "detail": "<assessment + suggestion if needed>" },
    { "segment": "CTA (last 5s)",  "status": "STRONG|SOLID|NEEDS_WORK", "detail": "<assessment + better alternative if needed>" }
  ],
  "compliance": [
    { "rule": "<platform policy area>", "status": "CLEAR|SUGGESTION|FLAG", "detail": "<friendly note — SUGGESTION for minor tweaks, FLAG only for real violations>" }
  ],
  "platform_fit": {
    "primary": { "platform": "${platform}", "status": "OPTIMAL|GOOD|NEEDS_WORK", "detail": "<what works for this platform + a tip>" },
    "crosspost": [
      { "platform": "<platform>", "status": "OPTIMAL|GOOD|NEEDS_WORK", "detail": "<brief note>" }
    ]
  },
  "language_check": {
    "status": "CLEAR|SUGGESTION",
    "issues": [
      { "found": "<word/phrase>", "issue": "<why it could be better>", "fix": "<friendly alternative>" }
    ]
  },
  "cta_check": {
    "text": "<extracted CTA>",
    "status": "STRONG|SOLID|NEEDS_WORK",
    "platform_compliant": true,
    "detail": "<assessment>",
    "suggestion": "<stronger CTA if it could be better — otherwise null>"
  },
  "top_fixes": ["<most impactful improvement #1 — specific and actionable>", "<improvement #2>", "<improvement #3>"],
  "strengths": ["<genuine strength #1>", "<genuine strength #2>", "<genuine strength #3>"],
  "estimated_hook_score": <1-10>,
  "word_count": <number>,
  "reading_time_seconds": <estimated VO seconds>
}`;

    // Rate limit check
    if (user_id) {
      const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user_id).single();
      // ── Cost-based throttle check ──
      const throttle = await checkThrottle(supabase, user_id);
      if (!throttle.allowed) {
        return new Response(JSON.stringify({
          error: 'rate_limited',
          message: 'Processing will be available shortly. Please try again in a moment.',
          retry_after_seconds: throttle.retry_after,
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
