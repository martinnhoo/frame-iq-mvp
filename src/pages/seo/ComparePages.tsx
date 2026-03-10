import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SeoLayout } from "@/components/seo/SeoLayout";
import { SeoCTA } from "@/components/seo/SeoCTA";
import { supabase } from "@/integrations/supabase/client";

const jakarta = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const mono    = { fontFamily: "'DM Mono', monospace" };

const STATIC_COMPARISONS = [
  {
    slug: "frameiq-vs-adspy", competitor_name: "AdSpy", frameiq_price: "From $19/mo", competitor_price: "$149/mo",
    headline: "FrameIQ vs AdSpy — Which Ad Intelligence Tool Is Right for You?",
    summary: "AdSpy is a Facebook/Instagram ad spy tool with a massive ad database. FrameIQ is an AI-powered creative analyzer that scores your own ads, generates scripts, and decodes competitors. Different tools, different jobs.",
    meta_title: "FrameIQ vs AdSpy — Full Comparison 2025",
    meta_description: "FrameIQ vs AdSpy: detailed comparison of features, pricing, and use cases. Which ad intelligence tool is right for your team?",
    frameiq_pros: ["AI hook scoring (0–10)", "Video analysis in 60s", "Creative brief generator", "Translation & transcription", "Competitor decoder", "Free plan available"],
    competitor_pros: ["Massive Facebook/Instagram ad database", "Long ad history", "Country & language filters"],
    feature_table: [
      { feature: "AI hook scoring",        frameiq: "Yes", competitor: "No" },
      { feature: "Video upload analysis",  frameiq: "Yes", competitor: "No" },
      { feature: "Ad database browsing",   frameiq: "No",  competitor: "Yes" },
      { feature: "Creative brief generator",frameiq:"Yes", competitor: "No" },
      { feature: "Competitor decoder",     frameiq: "Yes", competitor: "No" },
      { feature: "Free plan",              frameiq: "Yes", competitor: "No" },
      { feature: "Monthly price",          frameiq: "$19", competitor: "$149" },
    ],
  },
  {
    slug: "frameiq-vs-bigspy", competitor_name: "BigSpy", frameiq_price: "From $19/mo", competitor_price: "From $9/mo",
    headline: "FrameIQ vs BigSpy — Ad Spy Tool vs AI Creative Analyzer",
    summary: "BigSpy is a multi-platform ad spy tool. FrameIQ helps you improve YOUR own creatives using AI. If you want to browse competitor ads, BigSpy covers more platforms. If you want to understand why ads work and make better ones, FrameIQ wins.",
    meta_title: "FrameIQ vs BigSpy — Full Comparison 2025",
    meta_description: "FrameIQ vs BigSpy: compare features, pricing, and use cases. Find out which ad tool fits your workflow.",
    frameiq_pros: ["AI creative analysis", "Hook scoring & benchmarks", "Script generation", "Video transcription", "Competitor pattern decoder"],
    competitor_pros: ["Multi-platform ad library", "Lower entry price", "Filter by country & category"],
    feature_table: [
      { feature: "AI hook scoring",        frameiq: "Yes", competitor: "No" },
      { feature: "Ad library browsing",    frameiq: "No",  competitor: "Yes" },
      { feature: "Creative brief generator",frameiq:"Yes", competitor: "No" },
      { feature: "Free plan",              frameiq: "Yes", competitor: "Limited" },
      { feature: "Monthly price",          frameiq: "$19", competitor: "$9" },
    ],
  },
  {
    slug: "frameiq-vs-minea", competitor_name: "Minea", frameiq_price: "From $19/mo", competitor_price: "From $49/mo",
    headline: "FrameIQ vs Minea — Creative Intelligence vs Product Research",
    summary: "Minea is primarily a product research and ad spy tool popular with dropshippers. FrameIQ is built for creative teams who need to analyze, score, and improve ad performance with AI.",
    meta_title: "FrameIQ vs Minea — Full Comparison 2025",
    meta_description: "FrameIQ vs Minea: which tool is best for ad creative analysis? Full feature and pricing comparison.",
    frameiq_pros: ["AI analysis in 60s", "Hook score & benchmarks", "Brief generation", "Free plan available"],
    competitor_pros: ["Product research features", "Influencer discovery", "Pinterest & TikTok coverage"],
    feature_table: [
      { feature: "AI hook scoring",        frameiq: "Yes", competitor: "No" },
      { feature: "Product research",       frameiq: "No",  competitor: "Yes" },
      { feature: "Creative brief generator",frameiq:"Yes", competitor: "No" },
      { feature: "Free plan",              frameiq: "Yes", competitor: "No" },
      { feature: "Monthly price",          frameiq: "$19", competitor: "$49" },
    ],
  },
];

// ── Compare Index ────────────────────────────────────────────────────────────
export function CompareIndex() {
  const navigate = useNavigate();

  return (
    <SeoLayout
      title="FrameIQ Comparisons — vs AdSpy, BigSpy, Minea | FrameIQ"
      description="Compare FrameIQ to other ad intelligence tools. Honest feature, pricing, and use case comparisons."
      canonical="/compare"
    >
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "64px 24px 0" }}>
        <div style={{ marginBottom: 52 }}>
          <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>
            Comparisons
          </div>
          <h1 style={{ ...jakarta, fontSize: 40, fontWeight: 800, letterSpacing: "-0.035em", marginBottom: 14, lineHeight: 1.1 }}>
            How FrameIQ compares<br />
            <span style={{ background: "linear-gradient(135deg,#a78bfa,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              to other ad tools
            </span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", maxWidth: 500, lineHeight: 1.6 }}>
            Honest, feature-by-feature comparisons. No fluff.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {STATIC_COMPARISONS.map(c => (
            <div key={c.slug}
              onClick={() => navigate(`/compare/${c.slug}`)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "20px 24px", borderRadius: 16, background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", transition: "border-color .15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.3)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"}
            >
              <div>
                <p style={{ ...jakarta, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                  FrameIQ vs {c.competitor_name}
                </p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
                  {c.frameiq_price} · vs {c.competitor_price}
                </p>
              </div>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }}>→</span>
            </div>
          ))}
        </div>

        <SeoCTA headline="See FrameIQ in action" sub="Free plan available. No credit card required." primaryLabel="Try for free" />
      </div>
    </SeoLayout>
  );
}

// ── Compare Detail ───────────────────────────────────────────────────────────
export function CompareDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [comp, setComp] = useState(STATIC_COMPARISONS.find(c => c.slug === slug) ?? null);

  useEffect(() => {
    if (!slug) return;
    supabase.from("seo_comparisons").select("*").eq("slug", slug).eq("published", true).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setComp({
            ...data,
            feature_table: Array.isArray(data.feature_table) ? data.feature_table as typeof comp.feature_table : [],
          } as typeof comp);
        }
      });
  }, [slug]);

  if (!comp) return (
    <SeoLayout title="Comparison Not Found — FrameIQ" description="" noIndex>
      <div style={{ textAlign: "center", padding: "120px 24px" }}>
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Comparison not found.</p>
        <button onClick={() => navigate("/compare")} style={{ color: "#a78bfa", background: "none", border: "none", cursor: "pointer", marginTop: 12 }}>← All comparisons</button>
      </div>
    </SeoLayout>
  );

  return (
    <SeoLayout title={comp.meta_title} description={comp.meta_description} canonical={`/compare/${slug}`}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px 0" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          <button onClick={() => navigate("/compare")} style={{ color: "rgba(255,255,255,0.25)", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>Compare</button>
          <span>/</span><span style={{ color: "rgba(255,255,255,0.5)" }}>vs {comp.competitor_name}</span>
        </div>

        <h1 style={{ ...jakarta, fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 20, lineHeight: 1.1 }}>
          {comp.headline}
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 40 }}>
          {comp.summary}
        </p>

        {/* Feature table */}
        <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 40 }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "rgba(255,255,255,0.04)", padding: "12px 20px" }}>
            <span style={{ ...mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Feature</span>
            <span style={{ ...mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#a78bfa", textAlign: "center" }}>FrameIQ</span>
            <span style={{ ...mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>{comp.competitor_name}</span>
          </div>
          {comp.feature_table.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "13px 20px", borderTop: "1px solid rgba(255,255,255,0.05)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{row.feature}</span>
              <span style={{ fontSize: 13, textAlign: "center", color: row.frameiq === "Yes" ? "#34d399" : row.frameiq === "No" ? "rgba(255,255,255,0.2)" : "#a78bfa", fontWeight: row.frameiq === "Yes" ? 600 : 400 }}>{row.frameiq}</span>
              <span style={{ fontSize: 13, textAlign: "center", color: row.competitor === "Yes" ? "#34d399" : row.competitor === "No" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", fontWeight: 400 }}>{row.competitor}</span>
            </div>
          ))}
        </div>

        {/* Pros */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 40 }}>
          <div style={{ borderRadius: 16, padding: 20, background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)" }}>
            <p style={{ ...mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#a78bfa", marginBottom: 14 }}>FrameIQ strengths</p>
            {comp.frameiq_pros.map(p => (
              <div key={p} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
                <span style={{ color: "#34d399", flexShrink: 0 }}>✓</span>{p}
              </div>
            ))}
          </div>
          <div style={{ borderRadius: 16, padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ ...mono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>{comp.competitor_name} strengths</p>
            {comp.competitor_pros.map(p => (
              <div key={p} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>
                <span style={{ flexShrink: 0, color: "rgba(255,255,255,0.2)" }}>✓</span>{p}
              </div>
            ))}
          </div>
        </div>

        {/* Other comparisons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 48, flexWrap: "wrap" }}>
          {STATIC_COMPARISONS.filter(c => c.slug !== slug).map(c => (
            <button key={c.slug} onClick={() => navigate(`/compare/${c.slug}`)}
              style={{ fontSize: 13, padding: "7px 14px", borderRadius: 20, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
              vs {c.competitor_name}
            </button>
          ))}
        </div>

        <SeoCTA headline={`Try FrameIQ free — no credit card`} sub={`See why teams switch from ${comp.competitor_name} to FrameIQ for creative analysis.`} />
      </div>
    </SeoLayout>
  );
}
