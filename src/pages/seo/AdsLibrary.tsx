import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SeoLayout } from "@/components/seo/SeoLayout";
import { SeoCTA } from "@/components/seo/SeoCTA";
import { SEO_LANDING_PAGES, SEO_PLATFORMS, SEO_INDUSTRIES } from "@/data/seoData";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const m = { fontFamily: "'DM Mono', monospace" };

// Placeholder ad cards — will be replaced with real ads as library grows
const PLACEHOLDER_ADS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  hookScore: (6.5 + Math.random() * 2.5).toFixed(1),
  hookType: ["Curiosity", "Social Proof", "Transformation", "Pattern Interrupt", "Fear", "Question"][i % 6],
  platform: ["tiktok", "facebook", "instagram"][i % 3],
  industry: ["ecommerce", "igaming", "saas", "beauty"][i % 4],
  duration: [15, 22, 30, 45][i % 4],
  creativeType: ["UGC", "Talking Head", "Product Demo", "Animation"][i % 4],
}));

const scoreColor = (s: string) => {
  const n = parseFloat(s);
  if (n >= 8) return "#34d399";
  if (n >= 6) return "#fbbf24";
  return "#f87171";
};

export function AdsLibraryIndex() {
  const navigate = useNavigate();
  const pages = SEO_LANDING_PAGES;

  return (
    <SeoLayout title="Ad Creative Library — AdBrief" description="Browse top-performing ad creatives analyzed by AI. Hook scores, creative breakdowns, and frameworks for every ad." canonical="/ads-library">
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "64px 24px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{ ...m, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>Ads Library</p>
          <h1 style={{ ...j, fontSize: 44, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 14 }}>
            Ad creatives that<br />
            <span style={{ background: "linear-gradient(135deg,#a78bfa,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>actually work</span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
            Every ad scored and analyzed by AI. Learn the hook, the framework, and why it converts.
          </p>
        </div>

        {/* Browse by category */}
        <div style={{ marginBottom: 56 }}>
          <p style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 20 }}>Browse by category</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {pages.map(page => (
              <div key={page.slug} onClick={() => navigate(`/${page.slug}`)}
                style={{ padding: "20px 22px", borderRadius: 16, background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", transition: "border-color .15s, transform .12s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>
                <p style={{ ...j, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{page.title}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>{page.subheadline}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Browse by platform */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 16 }}>By platform</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {SEO_PLATFORMS.map(p => (
              <button key={p.slug} onClick={() => navigate(`/${p.slug}-ad-examples`)}
                style={{ ...j, display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Browse by industry */}
        <div style={{ marginBottom: 56 }}>
          <p style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 16 }}>By industry</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {SEO_INDUSTRIES.map(ind => (
              <button key={ind.slug} onClick={() => navigate(`/${ind.slug}-ad-examples`)}
                style={{ ...j, padding: "10px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                {ind.label}
              </button>
            ))}
          </div>
        </div>

        <SeoCTA headline="Analyze your own ad" sub="Upload any video and get a hook score, creative breakdown, and improvement suggestions in 60 seconds." />
      </div>
    </SeoLayout>
  );
}

export function AdsLibraryLanding() {
  // Hardcoded routes (/tiktok-ad-examples etc) have no :slug param —
  // derive slug from the current pathname instead
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const { pathname } = { pathname: typeof window !== 'undefined' ? window.location.pathname : '' };
  const slug = paramSlug ?? pathname.replace(/^\//, '');
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Find the matching landing page config
  const page = SEO_LANDING_PAGES.find(p => p.slug === slug)
    ?? SEO_LANDING_PAGES.find(p => slug?.includes(p.filterPlatform ?? "") || slug?.includes(p.filterIndustry ?? ""));

  if (!page) return (
    <SeoLayout title="Ad Examples — FrameIQ" description="Browse top ad examples with hook scores and AI analysis." canonical={`/${slug}`}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "64px 24px 0" }}>
        <AdsLibraryGrid title="Ad Examples" />
        <SeoCTA />
      </div>
    </SeoLayout>
  );

  const hookTypes = ["Curiosity", "Social Proof", "Transformation", "Pattern Interrupt", "Fear", "Question"];
  const related = page.relatedPages?.map(s => SEO_LANDING_PAGES.find(p => p.slug === s)).filter(Boolean) ?? [];

  return (
    <SeoLayout title={page.metaTitle} description={page.metaDescription} canonical={`/${slug}`}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "64px 24px 0" }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ ...m, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>Ads Library</p>
          <h1 style={{ ...j, fontSize: 42, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 14 }}>{page.headline}</h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", maxWidth: 560, lineHeight: 1.6, marginBottom: 24 }}>{page.intro}</p>
        </div>

        {/* Hook type filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
          <button onClick={() => setActiveFilter(null)}
            style={{ ...j, padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: !activeFilter ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)", color: !activeFilter ? "#a78bfa" : "rgba(255,255,255,0.4)", border: `1px solid ${!activeFilter ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`, cursor: "pointer" }}>
            All hooks
          </button>
          {hookTypes.map(ht => (
            <button key={ht} onClick={() => setActiveFilter(activeFilter === ht ? null : ht)}
              style={{ ...j, padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: activeFilter === ht ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)", color: activeFilter === ht ? "#a78bfa" : "rgba(255,255,255,0.4)", border: `1px solid ${activeFilter === ht ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`, cursor: "pointer" }}>
              {ht}
            </button>
          ))}
        </div>

        <AdsLibraryGrid title="" filter={activeFilter} />

        {/* Related pages */}
        {related.length > 0 && (
          <div style={{ marginTop: 56, marginBottom: 32 }}>
            <p style={{ ...m, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 16 }}>Related libraries</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {related.map(r => r && (
                <button key={r.slug} onClick={() => navigate(`/${r.slug}`)}
                  style={{ ...j, padding: "9px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                  {r.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <SeoCTA headline="Analyze your own ad free" sub="Get a hook score, creative breakdown, and AI suggestions in 60 seconds." />
      </div>
    </SeoLayout>
  );
}

function AdsLibraryGrid({ title, filter }: { title: string; filter?: string | null }) {
  const navigate = useNavigate();
  const ads = filter ? PLACEHOLDER_ADS.filter(a => a.hookType === filter) : PLACEHOLDER_ADS;

  return (
    <div>
      {title && <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 20 }}>{title}</h2>}

      {/* Coming soon state + locked cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
        {ads.map((ad) => (
          <div key={ad.id}
            style={{ background: "#0e0e12", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, overflow: "hidden", position: "relative" }}>
            {/* Thumbnail placeholder */}
            <div style={{ height: 140, background: `linear-gradient(135deg, rgba(167,139,250,0.08), rgba(244,114,182,0.05))`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <span style={{ fontSize: 32, opacity: 0.3 }}>🎬</span>
              {/* Hook score badge */}
              <div style={{ position: "absolute", top: 10, left: 10, padding: "4px 10px", borderRadius: 20, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: scoreColor(ad.hookScore) }}>{ad.hookScore}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>hook</span>
              </div>
              {/* Lock overlay */}
              <div style={{ position: "absolute", inset: 0, background: "rgba(6,6,8,0.5)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button onClick={() => navigate("/signup")}
                  style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", padding: "8px 18px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#000", border: "none", cursor: "pointer" }}>
                  View analysis →
                </button>
              </div>
            </div>

            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, padding: "3px 8px", borderRadius: 10, background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}>{ad.hookType}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, padding: "3px 8px", borderRadius: 10, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>{ad.creativeType}</span>
              </div>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{ad.duration}s · {ad.platform}</p>
            </div>
          </div>
        ))}
      </div>

      {/* "Submit your ad" nudge */}
      <div style={{ marginTop: 24, textAlign: "center", padding: "20px", borderRadius: 16, border: "1px dashed rgba(255,255,255,0.1)" }}>
        <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
          Want your winning ad featured here?
        </p>
        <button onClick={() => navigate("/signup")}
          style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600, background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)", cursor: "pointer" }}>
          Submit an ad →
        </button>
      </div>
    </div>
  );
}
