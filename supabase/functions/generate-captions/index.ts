import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Platform = "tiktok" | "reels" | "facebook" | "linkedin";

const PLATFORM_RULES: Record<Platform, string> = {
  tiktok:   "Max 100 characters. No emojis. Hook-first sentence. Lowercase or sentence case — never ALL CAPS. Spoken-word rhythm. End with a subtle CTA or open loop. Sound like a real person, never a brand intern.",
  reels:    "Max 150 characters. 3–4 emojis max, placed naturally (never forced). Conversational and warm. End with a direct CTA. Think: your coolest friend talking about something they love.",
  facebook: "Exactly 4 lines. One emoji per line. Short punchy phrases. Line 1: hook. Lines 2–3: value/context. Line 4: CTA. Friendly tone, never corporate.",
  linkedin: "2–3 short paragraphs. Professional but human — no buzzwords, no fluff. Lead with an insight or observation. End with a thought-provoking question or subtle CTA. Sounds like someone who actually knows their stuff.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth guard ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    // ─────────────────────────────────────────────────────────────────────────
    const { files, platforms, context } = await req.json() as {
      files: Array<{ id: string; name: string; type: string; base64: string | null }>;
      platforms: Platform[];
      context: string;
    };

    if (!files?.length || !platforms?.length) {
      return new Response(JSON.stringify({ error: "Missing files or platforms" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });

    const systemPrompt = `You are a senior performance marketing creative strategist with 10+ years writing social media captions for iGaming, DTC, and consumer apps. Your captions consistently outperform AI-generated content because they sound like real humans — specific, punchy, and platform-native.

Your job: generate captions that do NOT sound like AI. No generic phrases. No hollow enthusiasm. No "Unlock your potential" or "Game-changer" or "In today's digital landscape". Write like a person who knows the product, the audience, and the platform deeply.

Rules you never break:
- Never use: "delve", "dive in", "unlock", "elevate", "transform", "game-changer", "at the end of the day", "in today's world"
- Never start with "I"
- Never use hashtags unless the platform specifically benefits from them
- Each caption must feel like it was written by a different person — vary sentence structure, rhythm, and angle
- Always respect platform character limits and formatting rules precisely`;

    const results = await Promise.all(files.map(async (file) => {
      const platformResults = await Promise.all(platforms.map(async (platform) => {
        const userContent: Anthropic.MessageParam["content"] = [];

        if (file.base64 && file.type.startsWith("image/")) {
          userContent.push({
            type: "image",
            source: {
              type: "base64",
              media_type: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: file.base64,
            },
          });
        }

        const contextBlock = context?.trim()
          ? `\nAdditional context from the marketer: "${context.trim()}"\nUse this to make captions specific — reference the product, offer, or audience directly when it improves quality.`
          : "\nNo additional context was provided. Infer from the filename and write compelling captions based on what you can determine.";

        userContent.push({
          type: "text",
          text: `File: ${file.name} (${file.type})
Platform: ${platform.toUpperCase()}
Platform rules: ${PLATFORM_RULES[platform]}
${contextBlock}

Write exactly 3 caption variations for this file optimized for ${platform.toUpperCase()}.

Return ONLY a JSON object with this exact structure — no markdown, no explanation:
{"captions": ["caption 1", "caption 2", "caption 3"]}

Each caption must be distinctly different in angle, not just rephrased. All must respect the platform rules exactly.`,
        });

        const response = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        });

        const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
        let captions: string[] = [];
        try {
          const clean = raw.replace(/```json|```/g, "").trim();
          captions = JSON.parse(clean).captions || [];
        } catch {
          captions = raw.split("\n").filter(l => l.trim().startsWith('"') || l.trim().match(/^\d\./)).slice(0, 3);
        }

        return { platform, captions };
      }));

      return { fileId: file.id, filename: file.name, results: platformResults };
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("generate-captions error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
