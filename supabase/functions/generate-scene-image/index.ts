const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 503, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { visual_description, scene_title, scene_index, character_context, location_context } = await req.json();

    if (!visual_description) {
      return new Response(JSON.stringify({ error: "Missing visual_description" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Build character consistency block
    const charBlock = character_context
      ? `\nCHARACTER CONSISTENCY (CRITICAL — same person in ALL scenes):
- Appearance: ${character_context.appearance || 'not specified'}
- Clothing: ${character_context.clothing || 'not specified'}
- Gender/Age: ${character_context.gender || 'not specified'}, ${character_context.age || 'not specified'}
- Hair: ${character_context.hair || 'not specified'}
- Skin tone: ${character_context.skin_tone || 'not specified'}
You MUST depict the EXACT SAME person with the EXACT SAME clothes, hairstyle, and features in every scene.`
      : '';

    const locationBlock = location_context
      ? `\nLOCATION CONSISTENCY: ${location_context}`
      : '';

    const prompt = `Create a high-quality, photorealistic production storyboard reference image for a video ad scene.

Scene: "${scene_title || `Scene ${(scene_index ?? 0) + 1}`}"
Visual direction: ${visual_description}
${charBlock}
${locationBlock}

Requirements:
- Square 1:1 composition
- Photorealistic, cinematic lighting and color grading
- Professional advertising production quality
- Clean composition with clear focal point
- No text, no watermarks, no UI overlays, no borders
- Studio-quality or on-location production feel
- Should look like a real frame from a high-budget video ad`;

    console.log(`Generating scene image ${scene_index}: ${scene_title}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("AI image generation error:", res.status, errText);
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please wait a moment and try again" }), {
          status: 429, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — please add credits" }), {
          status: 402, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI image error: ${res.status}`);
    }

    const data = await res.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(data).slice(0, 500));
      throw new Error("No image generated — try again");
    }

    console.log(`Scene ${scene_index} image generated successfully`);

    return new Response(JSON.stringify({ 
      url: imageUrl, 
      scene_index,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("generate-scene-image error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
