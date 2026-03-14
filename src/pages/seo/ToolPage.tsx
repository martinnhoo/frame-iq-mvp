import { useParams, useNavigate } from "react-router-dom";
import { SeoLayout } from "@/components/seo/SeoLayout";
import { SeoCTA } from "@/components/seo/SeoCTA";
import { SEO_TOOLS } from "@/data/seoData";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const m = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" };
const typeColor: Record<string, string> = { generator: "#fb923c", analyzer: "#22d3ee", calculator: "#34d399" };

export default function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const tool = SEO_TOOLS.find(t => t.slug === slug);

  if (!tool) return (
    <SeoLayout title="Tool Not Found — AdBrief" description="" noIndex>
      <div style={{ textAlign: "center", padding: "120px 24px" }}>
        <p style={{ color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>Tool not found.</p>
        <button onClick={() => navigate("/tools")} style={{ color: "#a78bfa", background: "none", border: "none", cursor: "pointer" }}>← Back to Tools</button>
      </div>
    </SeoLayout>
  );

  const accent = typeColor[tool.type] ?? "#a78bfa";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": tool.name,
    "description": tool.description,
    "applicationCategory": "BusinessApplication",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "operatingSystem": "Web",
    "url": `https://www.adbrief.pro/tools/${slug}`,
  };

  return (
    <SeoLayout title={tool.metaTitle} description={tool.metaDescription} canonical={`/tools/${slug}`} jsonLd={jsonLd}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "64px 24px 0" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          <button onClick={() => navigate("/tools")} style={{ color: "rgba(255,255,255,0.25)", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>Tools</button>
          <span>/</span><span style={{ color: "rgba(255,255,255,0.5)" }}>{tool.name}</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <span style={{ ...m, fontSize: 10, padding: "3px 10px", borderRadius: 20, background: `${accent}15`, color: accent, border: `1px solid ${accent}30`, letterSpacing: "0.12em", textTransform: "uppercase" }}>{tool.type}</span>
            {tool.isFree && <span style={{ ...m, fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>FREE</span>}
          </div>
          <h1 style={{ ...j, fontSize: 40, fontWeight: 800, letterSpacing: "-0.035em", marginBottom: 16, lineHeight: 1.1 }}>{tool.name}</h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 28 }}>{tool.description}</p>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => navigate(tool.dashboardRoute ?? "/signup")}
              style={{ ...j, padding: "13px 28px", borderRadius: 999, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#000", border: "none", cursor: "pointer" }}>
              {tool.requiresAuth ? "Try free — create account" : "Try it free"}
            </button>
            <button onClick={() => navigate("/pricing")}
              style={{ ...j, padding: "13px 22px", borderRadius: 999, fontSize: 14, fontWeight: 600, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
              See pricing
            </button>
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 40 }} />

        {/* How it works */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ ...j, fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 14 }}>How it works</h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.75 }}>{tool.longDescription}</p>
        </div>

        {/* Use cases */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ ...j, fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>What you can do with it</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tool.useCases.map(uc => (
              <div key={uc} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ color: accent, flexShrink: 0, marginTop: 1 }}>✓</span>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{uc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Related tools — clean grid */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 14 }}>More free tools</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {SEO_TOOLS.filter(t => t.slug !== slug).slice(0, 6).map(t => (
              <button key={t.slug} onClick={() => navigate(`/tools/${t.slug}`)}
                style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "border-color .15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.3)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"}>
                <p style={{ ...j, fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 3 }}>{t.name}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>{t.description.slice(0, 55)}…</p>
              </button>
            ))}
          </div>
        </div>

        <SeoCTA context="tool" />
      </div>
    </SeoLayout>
  );
}
