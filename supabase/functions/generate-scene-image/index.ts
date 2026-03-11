const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 503, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { visual_description, scene_title, scene_index } = await req.json();

    if (!visual_description) {
      return new Response(JSON.stringify({ error: "Missing visual_description" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Build a focused storyboard prompt
    const prompt = `Production storyboard reference frame for a mobile video ad. ${scene_title ? `Scene title: "${scene_title}". ` : ""}Visual direction: ${visual_description}. Style: clean cinematic production reference, realistic lighting, 9:16 vertical format. Shot composition suitable for TikTok/Reels. Professional ad production quality. No text, no watermarks, no UI overlays.`;

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1792",  // 9:16 portrait — matches mobile ad format
        quality: "standard",
        style: "natural",
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `DALL-E error ${res.status}`);
    }

    const data = await res.json();
    const url = data.data?.[0]?.url;

    if (!url) throw new Error("No image URL in response");

    return new Response(JSON.stringify({ url, scene_index, revised_prompt: data.data?.[0]?.revised_prompt }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("generate-scene-image error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
