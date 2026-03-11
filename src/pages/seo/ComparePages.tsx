import { useParams, useNavigate } from "react-router-dom";
import { SeoLayout } from "@/components/seo/SeoLayout";
import { SeoCTA } from "@/components/seo/SeoCTA";
import { SEO_COMPARISONS } from "@/data/seoData";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const m = { fontFamily: "'DM Mono', monospace" };

export function CompareIndex() {
  const navigate = useNavigate();
  return (
    <SeoLayout title="AdBrief vs AdSpy, BigSpy, Minea & More — AdBrief" description="Honest, feature-by-feature comparisons of AdBrief against other ad intelligence tools." canonical="/compare">
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "64px 24px 0" }}>
        <div style={{ marginBottom: 52 }}>
          <p style={{ ...m, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>Comparisons</p>
          <h1 style={{ ...j, fontSize: 40, fontWeight: 800, letterSpacing: "-0.035em", marginBottom: 14, lineHeight: 1.1 }}>
            How AdBrief compares<br />
            <span style={{ background: "linear-gradient(135deg,#a78bfa,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>to other ad tools</span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", maxWidth: 500, lineHeight: 1.6 }}>Honest, feature-by-feature comparisons. No fluff.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SEO_COMPARISONS.map(c => (
            <div key={c.slug} onClick={() => navigate(`/compare/${c.slug}`)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 24px", borderRadius: 16, background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", transition: "border-color .15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.3)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"}>
              <div>
                <p style={{ ...j, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>AdBrief vs {c.competitorName}</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>{c.frameiqPrice} · vs {c.competitorPrice}</p>
              </div>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>→</span>
            </div>
          ))}
        </div>

        <SeoCTA headline="See AdBrief in action" sub="Free plan available. No credit card required." primaryLabel="Try for free" />
      </div>
    </SeoLayout>
  );
}

export function CompareDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const comp = SEO_COMPARISONS.find(c => c.slug === slug);

  if (!comp) return (
    <SeoLayout title="Comparison Not Found — AdBrief" description="" noIndex>
      <div style={{ textAlign: "center", padding: "120px 24px" }}>
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Not found.</p>
        <button onClick={() => navigate("/compare")} style={{ color: "#a78bfa", background: "none", border: "none", cursor: "pointer", marginTop: 12 }}>← All comparisons</button>
      </div>
    </SeoLayout>
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": comp.headline,
    "description": comp.metaDescription,
    "author": { "@type": "Organization", "name": "AdBrief" },
    "url": `https://www.adbrief.pro/compare/${slug}`,
  };

  return (
    <SeoLayout title={comp.metaTitle} description={comp.metaDescription} canonical={`/compare/${slug}`} jsonLd={jsonLd}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px 0" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          <button onClick={() => navigate("/compare")} style={{ color: "rgba(255,255,255,0.25)", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>Compare</button>
          <span>/</span><span style={{ color: "rgba(255,255,255,0.5)" }}>vs {comp.competitorName}</span>
        </div>

        <h1 style={{ ...j, fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 20, lineHeight: 1.1 }}>{comp.headline}</h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.75, marginBottom: 40 }}>{comp.summary}</p>

        {/* Verdict badge */}
        <div style={{ borderRadius: 14, padding: "14px 20px", background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)", marginBottom: 40 }}>
          <p style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#a78bfa", marginBottom: 6 }}>Verdict</p>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{comp.verdict}</p>
        </div>

        {/* Feature table */}
        <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 40 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "rgba(255,255,255,0.04)", padding: "12px 20px" }}>
            <span style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Feature</span>
            <span style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#a78bfa", textAlign: "center" }}>AdBrief</span>
            <span style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>{comp.competitorName}</span>
          </div>
          {comp.featureTable.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "13px 20px", borderTop: "1px solid rgba(255,255,255,0.05)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{row.feature}</span>
              <span style={{ fontSize: 13, textAlign: "center", color: row.frameiq.includes("✓") ? "#34d399" : row.frameiq.includes("✗") ? "rgba(255,255,255,0.2)" : "#a78bfa", fontWeight: row.frameiq.includes("✓") ? 600 : 400 }}>{row.frameiq}</span>
              <span style={{ fontSize: 13, textAlign: "center", color: row.competitor.includes("✓") ? "#34d399" : row.competitor.includes("✗") ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)" }}>{row.competitor}</span>
            </div>
          ))}
        </div>

        {/* Pros */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 40 }}>
          <div style={{ borderRadius: 16, padding: 20, background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)" }}>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#a78bfa", marginBottom: 14 }}>AdBrief strengths</p>
            {comp.frameiqPros.map(p => (
              <div key={p} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                <span style={{ color: "#34d399", flexShrink: 0 }}>✓</span>{p}
              </div>
            ))}
          </div>
          <div style={{ borderRadius: 16, padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>{comp.competitorName} strengths</p>
            {comp.competitorPros.map(p => (
              <div key={p} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                <span style={{ flexShrink: 0, color: "rgba(255,255,255,0.2)" }}>✓</span>{p}
              </div>
            ))}
          </div>
        </div>

        {/* Other comparisons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 48, flexWrap: "wrap" }}>
          {SEO_COMPARISONS.filter(c => c.slug !== slug).map(c => (
            <button key={c.slug} onClick={() => navigate(`/compare/${c.slug}`)}
              style={{ fontSize: 13, padding: "7px 14px", borderRadius: 20, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
              vs {c.competitorName}
            </button>
          ))}
        </div>

        <SeoCTA headline={`Try AdBrief free`} sub={`See why teams choose AdBrief over ${comp.competitorName} for AI creative analysis.`} />
      </div>
    </SeoLayout>
  );
}
