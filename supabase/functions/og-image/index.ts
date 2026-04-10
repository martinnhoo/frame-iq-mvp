// og-image — generate OG preview image for demo shares
// GET /og-image?score=8 → returns SVG image

const log = (step: string, d?: unknown) =>
  console.log("[OG-IMAGE] " + step + (d ? " — " + JSON.stringify(d) : ""));

// Simple SVG to PNG conversion using a service
// For simplicity, we'll return SVG directly (most social platforms support it)
// If you need PNG, you can use a service like Cloudflare Workers or similar

const generateSvgImage = (score: number): string => {
  const scoreColor = score >= 8 ? "#22c55e" : score >= 5 ? "#f97316" : "#ef4444";
  const verdict = score >= 8 ? "Strong" : score >= 5 ? "Moderate" : "Needs Work";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#050508;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f0f1a;stop-opacity:1" />
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:0.15" />
      <stop offset="100%" style="stop-color:#6366f1;stop-opacity:0" />
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Glow effect -->
  <circle cx="600" cy="315" r="400" fill="url(#glow)" />

  <!-- Card background -->
  <rect x="150" y="100" width="900" height="430" rx="24" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" stroke-width="2" />

  <!-- Score display -->
  <text x="600" y="280" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="140" font-weight="800" text-anchor="middle" fill="${scoreColor}" letter-spacing="-2">
    ${score}
  </text>

  <!-- /10 suffix -->
  <text x="600" y="310" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="48" font-weight="600" text-anchor="middle" fill="rgba(255,255,255,0.3)">
    /10
  </text>

  <!-- Verdict -->
  <text x="600" y="380" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="${scoreColor}">
    ${verdict}
  </text>

  <!-- AdBrief branding -->
  <text x="600" y="480" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="24" font-weight="600" text-anchor="middle" fill="rgba(255,255,255,0.7)">
    Your Ad Score on AdBrief
  </text>

  <!-- Bottom accent line -->
  <line x1="250" y1="520" x2="950" y2="520" stroke="${scoreColor}" stroke-width="3" opacity="0.6" />
</svg>`;
};

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const score = parseInt(url.searchParams.get("score") || "5", 10);

    log("Generating OG image for score", score);

    const svg = generateSvgImage(score);

    // Return SVG directly (most platforms support SVG for OG images)
    // Some platforms may require PNG, but SVG is lighter and looks better
    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    log("Error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
