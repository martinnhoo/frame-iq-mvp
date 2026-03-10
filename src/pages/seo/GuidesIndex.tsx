import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SeoLayout } from "@/components/seo/SeoLayout";
import { SeoCTA } from "@/components/seo/SeoCTA";
import { supabase } from "@/integrations/supabase/client";

const jakarta = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const mono    = { fontFamily: "'DM Mono', monospace" };

const STATIC_GUIDES = [
  { slug: "tiktok-ads-guide",         title: "TikTok Ads: The Complete Guide for 2025",          summary: "Creative formats, hook types, bidding strategy, and scaling playbook.",         cluster: "tiktok-ads", read_time_min: 12 },
  { slug: "tiktok-ad-hooks-guide",    title: "TikTok Ad Hooks: 15 Proven Formulas",               summary: "The exact hook structures that generate 8+ hook scores on TikTok.",             cluster: "tiktok-ads", read_time_min: 8 },
  { slug: "tiktok-ad-structure-guide",title: "TikTok Ad Structure: Hook → Story → CTA",           summary: "The 3-part framework behind every high-performing TikTok ad.",                 cluster: "tiktok-ads", read_time_min: 7 },
  { slug: "tiktok-ad-testing-guide",  title: "TikTok Ad Testing: Find Your Winning Creative Fast", summary: "Systematic approach to creative testing — without burning budget.",            cluster: "tiktok-ads", read_time_min: 9 },
  { slug: "tiktok-ad-scaling-guide",  title: "How to Scale TikTok Ads Without Creative Fatigue",  summary: "Horizontal scaling, creative refresh cadence, and ROAS protection.",          cluster: "tiktok-ads", read_time_min: 10 },
];

const CLUSTER_LABELS: Record<string, string> = {
  "tiktok-ads": "TikTok Ads",
  "facebook-ads": "Facebook Ads",
  "creative-strategy": "Creative Strategy",
};

export default function GuidesIndex() {
  const navigate = useNavigate();
  const [guides, setGuides] = useState(STATIC_GUIDES);

  useEffect(() => {
    supabase.from("seo_content").select("slug,title,summary,cluster,read_time_min").eq("section", "guides").eq("published", true).order("cluster")
      .then(({ data }) => { if (data && data.length > 0) setGuides(data as typeof STATIC_GUIDES); });
  }, []);

  // Group by cluster
  const clusters: Record<string, typeof guides> = {};
  for (const g of guides) {
    const c = g.cluster ?? "other";
    if (!clusters[c]) clusters[c] = [];
    clusters[c].push(g);
  }

  return (
    <SeoLayout
      title="Advertising Guides — FrameIQ"
      description="Free guides on TikTok ads, ad hooks, creative testing, and scaling. Written for performance marketers and media buyers."
      canonical="/guides"
    >
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px 0" }}>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>
            Guides
          </div>
          <h1 style={{ ...jakarta, fontSize: 44, fontWeight: 800, letterSpacing: "-0.035em", marginBottom: 16, lineHeight: 1.1 }}>
            Learn to make ads<br />
            <span style={{ background: "linear-gradient(135deg,#a78bfa,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              that actually convert
            </span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", maxWidth: 520, lineHeight: 1.6 }}>
            Practical guides on creative strategy, hook writing, ad testing, and scaling — written for performance marketers.
          </p>
        </div>

        {/* Cluster groups */}
        {Object.entries(clusters).map(([cluster, clusterGuides]) => (
          <div key={cluster} style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ ...mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>
                {CLUSTER_LABELS[cluster] ?? cluster}
              </span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {clusterGuides.map((guide, i) => (
                <div key={guide.slug}
                  onClick={() => navigate(`/guides/${guide.slug}`)}
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 14, cursor: "pointer", transition: "background .12s, border-color .12s", border: "1px solid transparent" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}
                >
                  <span style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,0.2)", width: 20, flexShrink: 0 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...jakarta, fontSize: 15, fontWeight: 600, marginBottom: 3, letterSpacing: "-0.015em" }}>{guide.title}</p>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>{guide.summary}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {guide.read_time_min && (
                      <span style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{guide.read_time_min} min</span>
                    )}
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 14 }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <SeoCTA
          headline="Put it into practice"
          sub="Upload your next ad and get a hook score, platform fit, and AI suggestions in 60 seconds."
          primaryLabel="Analyze an ad free"
        />
      </div>
    </SeoLayout>
  );
}
