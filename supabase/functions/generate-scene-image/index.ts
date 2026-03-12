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

    const body = await req.json();
    const { visual_description, scene_title, scene_index, character_context, location_context, brand_logo_url } = body;

    console.log(`[INPUT] scene_index=${scene_index}, has_brand_logo=${!!brand_logo_url}, logo_length=${brand_logo_url?.length || 0}`);

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

    // STEP 1: Generate the base scene (without logo)
    const scenePrompt = `Create a high-quality, photorealistic production storyboard reference image for a video ad scene.

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
- Should look like a real frame from a high-budget video ad
${brand_logo_url ? '- IMPORTANT: Leave a natural surface visible where a brand logo could be placed (product, screen, packaging, signage, wall, etc.)' : ''}`;

    console.log(`[Step 1] Generating base scene ${scene_index}: ${scene_title}`);

    const sceneRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: scenePrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!sceneRes.ok) {
      const errText = await sceneRes.text();
      console.error("AI scene generation error:", sceneRes.status, errText);
      if (sceneRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please wait a moment and try again" }), {
          status: 429, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (sceneRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — please add credits" }), {
          status: 402, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI scene error: ${sceneRes.status}`);
    }

    const sceneData = await sceneRes.json();
    const sceneImageUrl = sceneData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!sceneImageUrl) {
      console.error("No image in scene response:", JSON.stringify(sceneData).slice(0, 500));
      throw new Error("No scene image generated — try again");
    }

    console.log(`[Step 1] Base scene ${scene_index} generated successfully`);

    // If no brand logo, return the base scene directly
    if (!brand_logo_url) {
      return new Response(JSON.stringify({ url: sceneImageUrl, scene_index }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // STEP 2: Composite the real logo into the scene using image editing
    console.log(`[Step 2] Compositing brand logo into scene ${scene_index}`);

    const compositePrompt = `You are given two images:
1. A photorealistic scene from a video ad storyboard
2. A brand logo

Your task: Place the EXACT brand logo from image 2 into the scene from image 1.
The logo must be placed NATURALLY on a visible surface in the scene — such as a product, phone screen, laptop screen, packaging, signage, storefront, clothing, wall poster, or any relevant surface.

CRITICAL RULES:
- The logo must be the EXACT same logo from image 2 — do NOT modify, redraw, or reinterpret it
- Reproduce the logo's exact colors, shapes, typography, and proportions
- The logo should look like it belongs in the scene (proper perspective, lighting, shadows)
- Do NOT change anything else in the scene — keep everything pixel-perfect except where the logo is placed
- The logo should be clearly visible but naturally integrated
- Match the surface's perspective and lighting`;

    const compositeRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: compositePrompt },
            { type: "image_url", image_url: { url: sceneImageUrl } },
            { type: "image_url", image_url: { url: brand_logo_url } },
          ],
        }],
        modalities: ["image", "text"],
      }),
    });

    if (!compositeRes.ok) {
      const errText = await compositeRes.text();
      console.error("Logo composite error:", compositeRes.status, errText);
      // If compositing fails, fall back to the base scene
      console.log(`[Step 2] Composite failed, returning base scene`);
      return new Response(JSON.stringify({ url: sceneImageUrl, scene_index }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const compositeData = await compositeRes.json();
    const finalImageUrl = compositeData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!finalImageUrl) {
      console.error("No image in composite response, falling back to base scene");
      return new Response(JSON.stringify({ url: sceneImageUrl, scene_index }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    console.log(`[Step 2] Logo composited successfully into scene ${scene_index}`);

    return new Response(JSON.stringify({ url: finalImageUrl, scene_index }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("generate-scene-image error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
