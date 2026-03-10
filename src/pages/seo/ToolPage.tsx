import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SeoLayout } from "@/components/seo/SeoLayout";
import { SeoCTA } from "@/components/seo/SeoCTA";
import { supabase } from "@/integrations/supabase/client";

const jakarta = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const mono    = { fontFamily: "'DM Mono', monospace" };

// Static fallback data so pages render even before DB is seeded
const TOOL_DATA: Record<string, {
  name: string; description: string; long_description: string;
  meta_title: string; meta_description: string;
  tool_type: string; is_free: boolean; requires_auth: boolean;
  dashboard_route: string | null; keywords: string[];
  related_guide_slugs: string[];
}> = {
  "ad-hook-generator": {
    name: "Ad Hook Generator",
    description: "Generate 10 high-converting ad hooks for any product in seconds.",
    long_description: "Describe your product and target audience, select your platform and tone — FrameIQ AI generates 10 proven hook formulas with predicted hook scores (0–10), platform fit tags, and CTA suggestions. Know which hook will convert before you spend on production.",
    meta_title: "Free Ad Hook Generator — FrameIQ",
    meta_description: "Generate high-converting ad hooks for TikTok, Facebook, and Instagram in seconds. Free AI tool by FrameIQ.",
    tool_type: "generator", is_free: true, requires_auth: false,
    dashboard_route: "/dashboard/hooks",
    keywords: ["ad hook generator", "tiktok hook ideas", "free ad hook generator", "hook generator for ads"],
    related_guide_slugs: ["tiktok-ad-hooks-guide", "tiktok-ads-guide"],
  },
  "ad-creative-analyzer": {
    name: "Ad Creative Analyzer",
    description: "Upload any video ad and get an instant hook score, platform fit analysis, and improvement suggestions.",
    long_description: "Drop your video — FrameIQ transcribes the audio with Whisper, scores the hook from 0 to 10, identifies the creative model (UGC, talking-head, product-demo), checks platform safe zones, and gives you 3 actionable improvements. Analysis in under 60 seconds.",
    meta_title: "Free Ad Creative Analyzer — Hook Score Tool | FrameIQ",
    meta_description: "Analyze your video ad for hook strength, platform fit, and CTR potential. Free AI tool. Get your hook score in 60 seconds.",
    tool_type: "analyzer", is_free: true, requires_auth: true,
    dashboard_route: "/dashboard/analyses/new",
    keywords: ["ad creative analyzer", "hook score tool", "video ad analyzer", "tiktok ad analyzer"],
    related_guide_slugs: ["tiktok-ads-guide", "tiktok-ad-structure-guide"],
  },
  "ad-script-generator": {
    name: "Ad Script Generator",
    description: "Turn your product description into a full video ad script — hook, body, CTA.",
    long_description: "Input your product, target audience, and platform. FrameIQ generates a complete ad script in the proven Hook → Story → CTA structure with scene-by-scene breakdown, VO copy, and on-screen text suggestions — ready to brief your editor or record immediately.",
    meta_title: "Free Ad Script Generator — FrameIQ",
    meta_description: "Generate complete video ad scripts for TikTok, Reels, and YouTube Shorts in seconds. Free AI tool by FrameIQ.",
    tool_type: "generator", is_free: true, requires_auth: true,
    dashboard_route: "/dashboard/boards/new",
    keywords: ["ad script generator", "video script generator", "tiktok script generator", "free ad script"],
    related_guide_slugs: ["tiktok-ad-structure-guide", "tiktok-ad-hooks-guide"],
  },
  "competitor-ad-decoder": {
    name: "Competitor Ad Decoder",
    description: "Paste any competitor ad script and get the full creative framework, emotional triggers, and counter-strategy.",
    long_description: "Paste the script or transcript of any competitor ad. FrameIQ reverse-engineers the hook type, persuasion model, emotional triggers, target audience profile, and gives you a counter-strategy — in seconds. No account required.",
    meta_title: "Competitor Ad Decoder — Free Tool | FrameIQ",
    meta_description: "Reverse-engineer any competitor ad in seconds. Understand the hook, framework, and tactics — then build your counter-strategy. Free AI tool.",
    tool_type: "analyzer", is_free: true, requires_auth: false,
    dashboard_route: "/dashboard/competitor",
    keywords: ["competitor ad analysis", "decode competitor ad", "ad framework analyzer", "reverse engineer ad"],
    related_guide_slugs: ["tiktok-ads-guide"],
  },
  "ctr-estimator": {
    name: "CTR Estimator",
    description: "Estimate the click-through rate of your ad creative based on hook type, platform, and industry benchmarks.",
    long_description: "Input your hook type, platform, ad format, and industry — FrameIQ benchmarks it against our creative intelligence database to estimate expected CTR range and conversion signals. Understand what performance to expect before you launch.",
    meta_title: "Ad CTR Estimator — Free Tool | FrameIQ",
    meta_description: "Estimate your ad CTR before spending a dollar. Free benchmark tool based on 10k+ ad creatives. By FrameIQ.",
    tool_type: "calculator", is_free: true, requires_auth: false,
    dashboard_route: null,
    keywords: ["ctr estimator", "ad ctr calculator", "tiktok ctr benchmark", "facebook ad ctr"],
    related_guide_slugs: ["tiktok-ad-testing-guide"],
  },
};

export default function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [tool, setTool] = useState(slug ? TOOL_DATA[slug] ?? null : null);

  useEffect(() => {
    if (!slug) return;
    supabase.from("seo_tools").select("*").eq("slug", slug).eq("published", true).maybeSingle()
      .then(({ data }) => { if (data) setTool(data as typeof tool); });
  }, [slug]);

  if (!tool) return (
    <SeoLayout title="Tool Not Found — FrameIQ" description="This tool doesn't exist." noIndex>
      <div style={{ textAlign: "center", padding: "120px 24px" }}>
        <p style={{ color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>Tool not found.</p>
        <button onClick={() => navigate("/tools")} style={{ color: "#a78bfa", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>
          ← Back to Tools
        </button>
      </div>
    </SeoLayout>
  );

  const type_label: Record<string, string> = { generator: "Generator", analyzer: "Analyzer", calculator: "Calculator", checker: "Checker" };
  const type_color: Record<string, string> = { generator: "#fb923c", analyzer: "#22d3ee", calculator: "#34d399", checker: "#a78bfa" };
  const accent = type_color[tool.tool_type] ?? "#a78bfa";

  return (
    <SeoLayout title={tool.meta_title} description={tool.meta_description} canonical={`/tools/${slug}`}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "64px 24px 0" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          <button onClick={() => navigate("/tools")} style={{ color: "rgba(255,255,255,0.25)", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>Tools</button>
          <span>/</span>
          <span style={{ color: "rgba(255,255,255,0.5)" }}>{tool.name}</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ ...mono, fontSize: 10, padding: "3px 10px", borderRadius: 20, background: `${accent}15`, color: accent, border: `1px solid ${accent}30`, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {type_label[tool.tool_type] ?? tool.tool_type}
            </span>
            {tool.is_free && (
              <span style={{ ...mono, fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                FREE
              </span>
            )}
          </div>

          <h1 style={{ ...jakarta, fontSize: 40, fontWeight: 800, letterSpacing: "-0.035em", marginBottom: 16, lineHeight: 1.1 }}>
            {tool.name}
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 28 }}>
            {tool.description}
          </p>

          {/* CTA button */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => navigate(tool.requires_auth ? (tool.dashboard_route ?? "/signup") : (tool.dashboard_route ?? "/signup"))}
              style={{ ...jakarta, padding: "13px 28px", borderRadius: 999, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#000", border: "none", cursor: "pointer" }}>
              {tool.requires_auth ? "Try it — free account" : "Try it free"}
            </button>
            <button onClick={() => navigate("/pricing")}
              style={{ ...jakarta, padding: "13px 22px", borderRadius: 999, fontSize: 14, fontWeight: 600, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
              See pricing
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 40 }} />

        {/* Long description */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ ...jakarta, fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 14 }}>
            How it works
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.75 }}>
            {tool.long_description}
          </p>
        </div>

        {/* Keywords / use cases */}
        {tool.keywords && tool.keywords.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <h2 style={{ ...jakarta, fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>
              What you can do with {tool.name}
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(tool.keywords as string[]).map((k: string) => (
                <span key={k} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related tools */}
        <div style={{ borderRadius: 20, padding: 24, background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 24 }}>
          <p style={{ ...mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>
            More free tools
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(TOOL_DATA).filter(([s]) => s !== slug).map(([s, t]) => (
              <button key={s} onClick={() => navigate(`/tools/${s}`)}
                style={{ fontSize: 13, padding: "7px 14px", borderRadius: 20, background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)", cursor: "pointer" }}>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <SeoCTA />
      </div>
    </SeoLayout>
  );
}
