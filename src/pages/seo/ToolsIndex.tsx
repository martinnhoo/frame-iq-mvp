import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SeoLayout } from "@/components/seo/SeoLayout";
import { SeoCTA } from "@/components/seo/SeoCTA";
import { supabase } from "@/integrations/supabase/client";

const jakarta = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const mono    = { fontFamily: "'DM Mono', monospace" };

const TOOL_ICONS: Record<string, string> = {
  generator: "⚡",
  analyzer:  "🔍",
  calculator:"📊",
  checker:   "✅",
};

// Fallback static tools in case DB is not seeded yet
const STATIC_TOOLS = [
  { slug: "ad-hook-generator",    name: "Ad Hook Generator",     description: "Generate 10 high-converting ad hooks for any product in seconds.", tool_type: "generator", is_free: true, dashboard_route: "/dashboard/hooks" },
  { slug: "ad-creative-analyzer", name: "Ad Creative Analyzer",  description: "Upload any video ad and get an instant hook score, platform fit, and improvement suggestions.", tool_type: "analyzer", is_free: true, dashboard_route: "/dashboard/analyses/new" },
  { slug: "ad-script-generator",  name: "Ad Script Generator",   description: "Turn your product description into a full Hook → Story → CTA video script.", tool_type: "generator", is_free: true, dashboard_route: "/dashboard/boards/new" },
  { slug: "competitor-ad-decoder", name: "Competitor Ad Decoder", description: "Paste any competitor ad and get the full creative framework, emotional triggers, and counter-strategy.", tool_type: "analyzer", is_free: true, dashboard_route: "/dashboard/competitor" },
  { slug: "ctr-estimator",         name: "CTR Estimator",         description: "Estimate your ad CTR based on hook type, platform, and industry benchmarks.", tool_type: "calculator", is_free: true, dashboard_route: null },
];

export default function ToolsIndex() {
  const navigate = useNavigate();
  const [tools, setTools] = useState(STATIC_TOOLS);

  useEffect(() => {
    supabase.from("seo_tools").select("*").eq("published", true).order("name")
      .then(({ data }) => { if (data && data.length > 0) setTools(data as typeof STATIC_TOOLS); });
  }, []);

  return (
    <SeoLayout
      title="Free Ad Creative Tools — FrameIQ"
      description="Free AI-powered tools for marketers and media buyers: hook generator, ad analyzer, script generator, competitor decoder, CTR estimator."
      canonical="/tools"
    >
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "64px 24px 0" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>
            Free Tools
          </div>
          <h1 style={{ ...jakarta, fontSize: 44, fontWeight: 800, letterSpacing: "-0.035em", marginBottom: 16, lineHeight: 1.1 }}>
            AI tools for better<br />
            <span style={{ background: "linear-gradient(135deg,#a78bfa,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              ad creatives
            </span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
            Free tools built for performance marketers, media buyers, and creative teams. No credit card required.
          </p>
        </div>

        {/* Tools grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16, marginBottom: 16 }}>
          {tools.map(tool => (
            <div key={tool.slug}
              onClick={() => navigate(`/tools/${tool.slug}`)}
              style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 24, cursor: "pointer", transition: "border-color .15s, transform .12s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {TOOL_ICONS[tool.tool_type ?? "generator"] ?? "⚡"}
                </div>
                {tool.is_free && (
                  <span style={{ ...mono, fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                    FREE
                  </span>
                )}
              </div>
              <h2 style={{ ...jakarta, fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>{tool.name}</h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, marginBottom: 16 }}>{tool.description}</p>
              <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                Try it free →
              </div>
            </div>
          ))}
        </div>

        <SeoCTA
          headline="Analyze your first ad free"
          sub="Get a hook score, platform fit, and AI suggestions in 60 seconds. No credit card required."
        />
      </div>
    </SeoLayout>
  );
}
