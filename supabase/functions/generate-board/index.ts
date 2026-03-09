import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── helpers ──────────────────────────────────────────────────────────────────

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PLAN_LIMITS: Record<string, number> = { free: 3, studio: 30, scale: 300 };

const MARKET_LANGUAGE: Record<string, string> = {
  BR: "PT", MX: "ES", AR: "ES", CO: "ES", ES: "ES",
  IN: "EN", JP: "JA", FR: "FR", DE: "DE", AE: "AR",
  US: "EN", AU: "EN", GB: "EN", CA: "EN",
  IT: "IT", ZA: "EN", NG: "EN", TH: "TH", PH: "EN", ID: "ID",
};

const MARKET_FLAG: Record<string, string> = {
  BR: "🇧🇷", MX: "🇲🇽", AR: "🇦🇷", CO: "🇨🇴", ES: "🇪🇸",
  IN: "🇮🇳", JP: "🇯🇵", FR: "🇫🇷", DE: "🇩🇪", AE: "🇦🇪",
  US: "🇺🇸", AU: "🇦🇺", GB: "🇬🇧", CA: "🇨🇦",
  IT: "🇮🇹", ZA: "🇿🇦", NG: "🇳🇬", TH: "🇹🇭", PH: "🇵🇭", ID: "🇮🇩",
  ANY: "🌍",
};

const PLATFORM_ASPECT: Record<string, string> = {
  tiktok: "9:16", reels: "9:16", youtube_shorts: "9:16",
  youtube: "16:9", facebook: "1:1", all: "9:16",
};

const CONTENT_BLOCKLIST = [
  "violence", "murder", "kill", "rape", "porn", "sex", "nude",
  "cocaine", "heroin", "meth", "drug trafficking", "illegal weapon",
  "terrorism", "bomb making",
];

async function callAI(prompt: string, retries = 1): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a creative intelligence AI. Return ONLY valid JSON. No markdown, no explanation, no code blocks. Just pure valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        }),
      });

      if (res.status === 429)
        throw new Error("RATE_LIMIT: AI rate limit exceeded, please try again shortly.");
      if (res.status === 402)
        throw new Error("CREDITS: AI credits exhausted. Please add funds to your workspace.");
      if (!res.ok) throw new Error(`AI error ${res.status}: ${await res.text()}`);

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      // Strip any accidental markdown code fences
      return content.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("AI call failed after retries");
}

function parseJSON(raw: string, fallback: unknown = null): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Try extracting JSON substring
    const match = raw.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

function sceneCount(duration: number): number {
  if (duration <= 15) return 3;
  if (duration <= 30) return 5;
  if (duration <= 60) return 8;
  if (duration <= 90) return 12;
  return Math.ceil(duration / 6);
}

function errorResponse(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return errorResponse("Unauthorized", 401);

    // ── Parse inputs ──────────────────────────────────────────────────────────
    const body = await req.json();
    let {
      prompt,
      market,
      language,
      vo_language,
      duration,
      platform,
      context,
      has_talent,
      talent_name,
      product_only,
      analysis_id,
      title,
    } = body;

    // Input validation
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 10) {
      return errorResponse("Please describe your video idea in more detail (minimum 10 characters).");
    }
    prompt = prompt.trim();

    // Content filter
    const lowerPrompt = prompt.toLowerCase();
    for (const word of CONTENT_BLOCKLIST) {
      if (lowerPrompt.includes(word)) {
        return errorResponse("This content violates our usage policy.");
      }
    }

    // Defaults
    market = (market || "ANY").toUpperCase();
    if (!MARKET_FLAG[market]) market = "ANY";
    const market_flag = MARKET_FLAG[market];
    duration = typeof duration === "number" && duration > 0 ? Math.round(duration) : 30;
    platform = platform || "tiktok";
    has_talent = !!has_talent;
    product_only = !!product_only;
    talent_name = talent_name?.trim() || null;
    const aspect_ratio = PLATFORM_ASPECT[platform] ?? "9:16";
    const duration_cap = platform === "all" ? 30 : duration;
    const platform_note = platform === "all" ? "optimized for vertical, all platforms" : "";

    // Language auto-detect
    if (!language) language = MARKET_LANGUAGE[market] ?? "EN";
    if (!vo_language) vo_language = language;

    // ── Pre-flight: usage limits ───────────────────────────────────────────────
    const period = new Date().toISOString().slice(0, 7);

    // Get user plan
    const { data: profileData } = await adminClient
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = profileData?.plan ?? "free";
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

    const { data: usageData } = await adminClient
      .from("usage")
      .select("boards_count")
      .eq("user_id", user.id)
      .eq("period", period)
      .single();

    const currentCount = usageData?.boards_count ?? 0;
    if (currentCount >= limit) {
      return errorResponse(
        `You've reached your ${plan} plan limit of ${limit} boards/month. Upgrade to generate more.`,
        403,
      );
    }

    // ── STEP 1 — Talent identification ────────────────────────────────────────
    let talentProfile: unknown = { identified: false };
    if (has_talent && talent_name) {
      const raw = await callAI(
        `You are a creative intelligence researcher.
The user wants to create an ad involving: '${talent_name}' for product/brand: '${prompt}'.

Identify:
- Full name and nationality
- What they are known for
- Their audience demographics
- Their content style and tone
- Their typical brand partnerships
- Any controversies to avoid
- Estimated follower count/reach
- Whether they are appropriate for this market: ${market}

If '${talent_name}' is a real known person, return:
{
  "identified": true,
  "full_name": "",
  "nationality": "",
  "known_for": "",
  "audience_age": "",
  "audience_gender": "",
  "content_style": "",
  "tone": "",
  "brand_fit": "",
  "controversies_to_avoid": null,
  "reach": "",
  "market_fit_score": 8,
  "market_fit_reason": ""
}

If NOT a real known person, return: {"identified": false}

Return ONLY valid JSON.`,
      );
      talentProfile = parseJSON(raw, { identified: false });
    }

    // ── STEP 2 — Audience profile ─────────────────────────────────────────────
    const rawAudience = await callAI(
      `Based on this campaign brief:
Product/Concept: ${prompt}
Market: ${market} ${market_flag}
Platform: ${platform}
Duration: ${duration_cap}s
Talent: ${JSON.stringify(talentProfile)}

Define the ideal target audience. Return ONLY valid JSON:
{
  "age_range": "",
  "gender_skew": "balanced",
  "income_level": "mid",
  "interests": [],
  "pain_points": [],
  "desires": [],
  "platform_behavior": "",
  "peak_hours": "",
  "purchase_trigger": "",
  "audience_language": "${language}",
  "cultural_notes": ""
}`,
    );
    const audience = parseJSON(rawAudience, {});

    // ── STEP 3 — Character profile ────────────────────────────────────────────
    let character: unknown = null;
    if (has_talent && !product_only) {
      const tp = talentProfile as Record<string, unknown>;
      const rawChar = await callAI(
        tp.identified
          ? `Create a character profile for real person: ${JSON.stringify(tp)}.
Brief: ${prompt}. Market: ${market}.

Return ONLY valid JSON:
{
  "type": "real_person",
  "name": "",
  "role": "",
  "why_they_work": "",
  "tone": "",
  "speech_style": "",
  "dos": [],
  "donts": [],
  "wardrobe_suggestion": "",
  "setting_suggestion": ""
}`
          : `Create a UGC creator character profile for:
Brief: ${prompt}. Market: ${market}. Language: ${language}.
Audience: ${JSON.stringify(audience)}.

Return ONLY valid JSON:
{
  "type": "ugc_creator",
  "age": "",
  "gender": "",
  "energy": "relatable",
  "personality": "",
  "wardrobe": "",
  "setting": "",
  "tone": "",
  "speech_pace": "medium",
  "accent_note": ""
}`,
      );
      character = parseJSON(rawChar, null);
    }

    // ── STEP 4 — Creative strategy ────────────────────────────────────────────
    const rawStrategy = await callAI(
      `You are a senior creative director.
Define the creative strategy for this ad.

Brief: ${prompt}
Market: ${market} ${market_flag}
Audience: ${JSON.stringify(audience)}
Character: ${JSON.stringify(character ?? "product only")}
Platform: ${platform}${platform_note ? " (" + platform_note + ")" : ""}
Duration: ${duration_cap}s
Aspect ratio: ${aspect_ratio}

Return ONLY valid JSON:
{
  "hook_type": "pattern_interrupt",
  "hook_duration_seconds": 3,
  "narrative_arc": "problem-solution",
  "cta_type": "direct",
  "pacing": "fast-cut",
  "has_voiceover": true,
  "has_captions": true,
  "caption_style": "bold-centered",
  "music_energy": "",
  "music_genre": "",
  "color_grade": "",
  "overall_tone": "",
  "key_message": ""
}`,
    );
    const strategy = parseJSON(rawStrategy, {});

    // ── STEP 5 — Scene breakdown ──────────────────────────────────────────────
    const numScenes = sceneCount(duration_cap);
    const rawScenes = await callAI(
      `Generate a complete scene breakdown for this video ad.

Brief: ${prompt}
Strategy: ${JSON.stringify(strategy)}
Character: ${JSON.stringify(character ?? "product only")}
VO Language: ${vo_language} — ALL vo_script and onscreen_text MUST be written in ${vo_language}${vo_language !== "EN" ? ", NOT in English" : ""}
Market: ${market} ${market_flag}
Platform: ${platform}
Duration: ${duration_cap}s
Scenes needed: ${numScenes}

Return ONLY a valid JSON array of ${numScenes} scenes:
[{
  "scene_number": 1,
  "timestamp": "0:00 - 0:05",
  "duration_seconds": 5,
  "type": "hook",
  "visual_description": "",
  "vo_script": null,
  "onscreen_text": null,
  "caption_text": null,
  "director_note": "",
  "b_roll_suggestion": null,
  "transition_to_next": "hard-cut"
}]`,
    );
    const scenes = parseJSON(rawScenes, []) as unknown[];

    // ── STEP 6 — Production notes ─────────────────────────────────────────────
    const rawProduction = await callAI(
      `Generate production notes for a video editor.

Strategy: ${JSON.stringify(strategy)}
Character: ${JSON.stringify(character ?? null)}
Market: ${market}
Platform: ${platform}
Duration: ${duration_cap}s
Aspect ratio: ${aspect_ratio}

Return ONLY valid JSON:
{
  "shoot_time_estimate": "",
  "location": "studio",
  "location_detail": "",
  "props": [],
  "wardrobe_detail": "",
  "lighting": "ring-light",
  "lighting_detail": "",
  "editing_style": "",
  "music_bpm": "",
  "music_reference": "",
  "caption_font_style": "",
  "aspect_ratio": "${aspect_ratio}",
  "resolution": "1080x1920",
  "fps": 30,
  "export_format": "MP4 H.264",
  "max_file_size": "500MB",
  "special_effects": null,
  "editor_briefing": ""
}`,
    );
    const production = parseJSON(rawProduction, {});

    // ── STEP 7 — Compliance check ─────────────────────────────────────────────
    const rawCompliance = await callAI(
      `Review this ad board for platform policy compliance.

Platform: ${platform}
Market: ${market}
Content: ${prompt}
Scenes summary: ${JSON.stringify(scenes.slice(0, 3))}

Check for platform advertising policies, market regulations, claims needing substantiation, age-restricted content.

Return ONLY valid JSON:
{
  "platform_safe": true,
  "overall_risk": "low",
  "issues": [],
  "suggestions": [],
  "disclaimer_needed": false,
  "disclaimer_text": null
}`,
    );
    const compliance = parseJSON(rawCompliance, {
      platform_safe: true,
      overall_risk: "low",
      issues: [],
      suggestions: [],
      disclaimer_needed: false,
      disclaimer_text: null,
    });

    // ── Assemble result ───────────────────────────────────────────────────────
    const result = {
      meta: {
        market,
        market_flag,
        language,
        vo_language,
        platform,
        aspect_ratio,
        duration: duration_cap,
        platform_note,
        has_talent,
        talent_name,
        product_only,
        analysis_id: analysis_id || null,
        generated_at: new Date().toISOString(),
      },
      talent_profile: talentProfile,
      audience,
      character,
      strategy,
      scenes,
      production,
      compliance,
    };

    // ── Save to boards table ──────────────────────────────────────────────────
    const { data: board, error: insertError } = await adminClient
      .from("boards")
      .insert({
        user_id: user.id,
        title: title || prompt.slice(0, 60),
        prompt,
        status: "ready",
        content: result as unknown as Record<string, unknown>,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Board insert error:", insertError);
      return errorResponse("Failed to save board", 500);
    }

    // ── Increment usage ───────────────────────────────────────────────────────
    if (usageData) {
      await adminClient
        .from("usage")
        .update({ boards_count: currentCount + 1 })
        .eq("user_id", user.id)
        .eq("period", period);
    } else {
      await adminClient
        .from("usage")
        .insert({ user_id: user.id, period, boards_count: 1 });
    }

    return new Response(JSON.stringify({ board_id: board.id, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-board error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.startsWith("RATE_LIMIT") ? 429
      : message.startsWith("CREDITS") ? 402
      : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
