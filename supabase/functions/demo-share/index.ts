// demo-share — create and retrieve shareable demo results
// GET /demo-share?share_id=<id> — returns JSON with analysis data and OG image URL
// POST /demo-share — creates a share record, returns share_id

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const html = (content: string, status = 200) =>
  new Response(content, {
    status,
    headers: { ...cors, "Content-Type": "text/html; charset=utf-8" },
  });

const log = (step: string, d?: unknown) =>
  console.log("[DEMO-SHARE] " + step + (d ? " — " + JSON.stringify(d) : ""));

// Generate a short hash from UUID (first 8 chars of base36 encoded)
const generateShareId = (uuid: string): string => {
  // Remove hyphens and take first 12 chars, then base36
  const clean = uuid.replace(/-/g, "").slice(0, 12);
  return BigInt("0x" + clean).toString(36).slice(0, 8).toLowerCase();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const url = new URL(req.url);
    const shareId = url.searchParams.get("share_id");

    // GET — retrieve shared analysis
    if (req.method === "GET" && shareId) {
      log("GET share_id", shareId);

      const { data, error } = await supabase
        .from("demo_leads")
        .select(
          "id, analysis_score, analysis_result, lang, created_at",
        )
        .eq("share_id", shareId)
        .single();

      if (error || !data) {
        log("Share not found", error);
        return json({ error: "not_found" }, 404);
      }

      // Check if request is from a browser (wants HTML with OG tags)
      const accept = req.headers.get("accept") || "";
      const userAgent = req.headers.get("user-agent") || "";
      const isBrowser = accept.includes("text/html") || /bot|crawler|spider/i.test(userAgent);

      const score = data.analysis_score ?? 0;
      const result = (data.analysis_result || {}) as Record<string, unknown>;
      const verdict = (result.verdict || "Analysis") as string;
      const hook = (result.hook || "Check out this ad analysis") as string;

      // If browser, return HTML with OG meta tags
      if (isBrowser) {
        const ogImageUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/og-image?score=${score}`;
        const shareUrl = `https://adbrief.pro/s/${shareId}`;
        const title = `My ad scored ${score}/10 — AdBrief`;
        const description = verdict;

        const html_content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>

  <!-- OG Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${shareUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <!-- Redirect to React app -->
  <script>
    window.location.href = "${shareUrl}";
  </script>
</head>
<body>
  Redirecting to AdBrief...
</body>
</html>`;
        return html(html_content);
      }

      // Return JSON for API clients
      return json({
        score,
        verdict,
        hook,
        lang: data.lang,
        created_at: data.created_at,
        og_image_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/og-image?score=${score}`,
      });
    }

    // POST — create a new share
    if (req.method === "POST") {
      const body = await req.json();
      const {
        analysis_score,
        analysis_result,
        email,
        lang,
      } = body as {
        analysis_score: number;
        analysis_result: Record<string, unknown>;
        email?: string;
        lang?: string;
      };

      if (analysis_score === undefined) {
        return json({ error: "missing_score" }, 400);
      }

      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("cf-connecting-ip")
        || "unknown";

      // Insert record
      const { data: insertData, error: insertError } = await supabase
        .from("demo_leads")
        .insert({
          email: email || null,
          ip_address: ip,
          analysis_score,
          analysis_result: analysis_result || {},
          lang: lang || "en",
        })
        .select("id")
        .single();

      if (insertError || !insertData) {
        log("Insert error", insertError);
        return json({ error: "insert_failed" }, 500);
      }

      // Generate share_id from UUID
      const shareId = generateShareId(insertData.id);

      // Update with share_id
      const { error: updateError } = await supabase
        .from("demo_leads")
        .update({ share_id: shareId })
        .eq("id", insertData.id);

      if (updateError) {
        log("Update share_id error", updateError);
        return json({ error: "update_failed" }, 500);
      }

      log("Created share", { id: insertData.id, share_id: shareId });
      return json({
        share_id: shareId,
        share_url: `https://adbrief.pro/s/${shareId}`,
      }, 201);
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (e) {
    log("Error", e);
    return json({ error: "internal_error", details: String(e) }, 500);
  }
});
