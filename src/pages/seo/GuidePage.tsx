import { useParams, useNavigate } from "react-router-dom";
import { SeoLayout } from "@/components/seo/SeoLayout";
import { SeoCTA } from "@/components/seo/SeoCTA";
import { SEO_GUIDES } from "@/data/seoData";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const m = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" };

export default function GuidePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const guide = SEO_GUIDES.find(g => g.slug === slug);

  if (!guide) return (
    <SeoLayout title="Guide Not Found — AdBrief" description="" noIndex>
      <div style={{ textAlign: "center", padding: "120px 24px" }}>
        <p style={{ color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>Guide not found.</p>
        <button onClick={() => navigate("/guides")} style={{ color: "#0ea5e9", background: "none", border: "none", cursor: "pointer" }}>← All guides</button>
      </div>
    </SeoLayout>
  );

  const related = SEO_GUIDES.filter(g => guide.relatedSlugs.includes(g.slug));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": guide.title,
    "description": guide.metaDescription,
    "author": { "@type": "Organization", "name": "AdBrief" },
    "publisher": { "@type": "Organization", "name": "AdBrief", "url": "https://www.adbrief.pro" },
    "url": `https://www.adbrief.pro/guides/${slug}`,
    "timeRequired": `PT${guide.readTime}M`,
  };

  return (
    <SeoLayout title={guide.metaTitle} description={guide.metaDescription} canonical={`/guides/${slug}`} jsonLd={jsonLd}>
      <div style={{ maxWidth: 740, margin: "0 auto", padding: "64px 24px 0" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          <button onClick={() => navigate("/guides")} style={{ color: "rgba(255,255,255,0.25)", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>Guides</button>
          <span>/</span>
          <span style={{ ...m, fontSize: 12, padding: "2px 8px", borderRadius: 10, background: "rgba(14,165,233,0.1)", color: "#0ea5e9" }}>{guide.clusterLabel}</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{guide.readTime} min read</span>
          </div>
          <h1 style={{ ...j, fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16, lineHeight: 1.1 }}>{guide.title}</h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{guide.subtitle}</p>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 40 }} />

        {/* Intro */}
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: 48 }}>{guide.intro}</p>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 40, marginBottom: 56 }}>
          {guide.sections.map((sec, i) => (
            <div key={i}>
              <h2 style={{ ...j, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.2)", width: 24 }}>{String(i + 1).padStart(2, "0")}</span>
                {sec.heading}
              </h2>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, paddingLeft: 34 }}>{sec.body}</p>
            </div>
          ))}
        </div>

        {/* Inline CTA */}
        <div style={{ borderRadius: 20, padding: "24px 28px", background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.18)", marginBottom: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <p style={{ ...j, fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Ready to put this into practice?</p>
          <button onClick={() => navigate(guide.ctaRoute)}
            style={{ ...j, padding: "10px 22px", borderRadius: 999, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
            {guide.ctaLabel}
          </button>
        </div>

        {/* Related guides */}
        {related.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <p style={{ ...m, fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 16 }}>Related guides</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {related.map(r => (
                <div key={r.slug} onClick={() => navigate(`/guides/${r.slug}`)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderRadius: 14, background: "#090910", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", transition: "border-color .15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.3)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"}>
                  <div>
                    <p style={{ ...j, fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{r.title}</p>
                    <p style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.2)" }}>{r.readTime} min</p>
                  </div>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>→</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <SeoCTA context="guide" />
      </div>
    </SeoLayout>
  );
}
