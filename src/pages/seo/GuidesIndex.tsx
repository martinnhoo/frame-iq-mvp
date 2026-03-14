import { useNavigate } from "react-router-dom";
import { SeoLayout } from "@/components/seo/SeoLayout";
import { SeoCTA } from "@/components/seo/SeoCTA";
import { SEO_GUIDES } from "@/data/seoData";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const m = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" };

export default function GuidesIndex() {
  const navigate = useNavigate();

  const clusters: Record<string, typeof SEO_GUIDES> = {};
  for (const g of SEO_GUIDES) {
    if (!clusters[g.cluster]) clusters[g.cluster] = [];
    clusters[g.cluster].push(g);
  }

  return (
    <SeoLayout title="Advertising Guides — AdBrief" description="Free guides on TikTok ads, ad hooks, creative testing, and scaling. Written for performance marketers and media buyers." canonical="/guides">
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px 0" }}>
        <div style={{ marginBottom: 52 }}>
          <p style={{ ...m, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>Guides</p>
          <h1 style={{ ...j, fontSize: 44, fontWeight: 800, letterSpacing: "-0.035em", marginBottom: 14, lineHeight: 1.1 }}>
            Learn to make ads<br />
            <span style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>that actually convert</span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", maxWidth: 500, lineHeight: 1.6 }}>
            Practical guides on creative strategy, hook writing, ad testing, and scaling.
          </p>
        </div>

        {Object.entries(clusters).map(([cluster, guides]) => (
          <div key={cluster} style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>{guides[0].clusterLabel}</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            </div>
            {guides.map((g, i) => (
              <div key={g.slug} onClick={() => navigate(`/guides/${g.slug}`)}
                style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 14, cursor: "pointer", border: "1px solid transparent", transition: "background .12s, border-color .12s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}>
                <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.2)", width: 20, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ ...j, fontSize: 15, fontWeight: 600, marginBottom: 3, letterSpacing: "-0.015em" }}>{g.title}</p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>{g.subtitle}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ ...m, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{g.readTime} min</span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>→</span>
                </div>
              </div>
            ))}
          </div>
        ))}

        <SeoCTA headline="Put it into practice" sub="Upload your ad and get a hook score, platform fit, and AI suggestions in 60 seconds." primaryLabel="Analyze an ad free" />
      </div>
    </SeoLayout>
  );
}
