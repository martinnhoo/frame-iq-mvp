import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";

interface SeoLayoutProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  children: React.ReactNode;
  noIndex?: boolean;
  jsonLd?: object;
}

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Pricing",  href: "/pricing" },
  { label: "Tools",    href: "/tools" },
  { label: "Guides",   href: "/guides" },
  { label: "Compare",  href: "/compare" },
  { label: "Ads Library", href: "/ads-library" },
];

const FOOTER_LINKS = {
  Product: [
    { label: "Features",    href: "/features" },
    { label: "Pricing",     href: "/pricing" },
    { label: "Changelog",   href: "/blog" },
  ],
  Tools: [
    { label: "Hook Generator",      href: "/tools/ad-hook-generator" },
    { label: "Script Generator",    href: "/tools/ad-script-generator" },
    { label: "Creative Analyzer",   href: "/tools/ad-creative-analyzer" },
    { label: "Competitor Decoder",  href: "/tools/competitor-ad-decoder" },
    { label: "CTR Estimator",       href: "/tools/ctr-estimator" },
  ],
  "Ad Library": [
    { label: "TikTok Ads",       href: "/tiktok-ad-examples" },
    { label: "Facebook Ads",     href: "/facebook-ad-examples" },
    { label: "UGC Ads",          href: "/ugc-ad-examples" },
    { label: "eCommerce Ads",    href: "/ecommerce-ad-examples" },
    { label: "Best Ad Hooks",    href: "/best-ad-hooks" },
  ],
  Guides: [
    { label: "TikTok Ads Guide",    href: "/guides/tiktok-ads-guide" },
    { label: "TikTok Ad Hooks",     href: "/guides/tiktok-ad-hooks-guide" },
    { label: "Ad Structure",        href: "/guides/tiktok-ad-structure-guide" },
    { label: "Creative Testing",    href: "/guides/tiktok-ad-testing-guide" },
  ],
  Compare: [
    { label: "vs AdSpy",        href: "/compare/adbrief-vs-adspy" },
    { label: "vs BigSpy",       href: "/compare/adbrief-vs-bigspy" },
    { label: "vs Minea",        href: "/compare/adbrief-vs-minea" },
    { label: "vs GoMarble",     href: "/compare/adbrief-vs-gomarble" },
    { label: "vs Madgicx",      href: "/compare/adbrief-vs-madgicx" },
    { label: "vs Triple Whale", href: "/compare/adbrief-vs-triple-whale" },
    { label: "vs Supermetrics", href: "/compare/adbrief-vs-supermetrics" },
  ],
};

export function SeoLayout({ title, description, canonical, ogImage, children, noIndex, jsonLd }: SeoLayoutProps) {
  const navigate = useNavigate();
  const base = "https://adbrief.pro";
  const canonicalUrl = canonical ? `${base}${canonical}` : undefined;

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
        {noIndex && <meta name="robots" content="noindex,nofollow" />}
        {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}

        {/* Open Graph */}
        <meta property="og:title"       content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type"        content="website" />
        {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
        {ogImage && <meta property="og:image" content={ogImage} />}

        {/* Twitter */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={title} />
        <meta name="twitter:description" content={description} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>

      <div style={{ minHeight: "100vh", background: "#060608", color: "#f0f0f5", fontFamily: "'Inter', system-ui, sans-serif" }}>

        {/* ── NAV ── */}
        <nav style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(6,6,8,0.9)", backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link to="/" style={{ textDecoration: "none" }}>
              <Logo size="md" />
            </Link>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {NAV_LINKS.map(l => (
                <Link key={l.href} to={l.href}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)", textDecoration: "none", transition: "color .15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#fff"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"}>
                  {l.label}
                </Link>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => navigate("/login")}
                style={{ padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, background: "transparent", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}>
                Sign in
              </button>
              <button onClick={() => navigate("/signup")}
                style={{ padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000", border: "none", cursor: "pointer" }}>
                Try free
              </button>
            </div>
          </div>
        </nav>

        {/* ── CONTENT ── */}
        <main>{children}</main>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 80, padding: "56px 24px 40px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", gap: 32, marginBottom: 48 }}>
              <div>
                <Logo size="md" />
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginTop: 12, maxWidth: 220 }}>
                  AI-powered ad creative intelligence. Score, analyze, and improve your video ads.
                </p>
              </div>
              {Object.entries(FOOTER_LINKS).map(([section, links]) => (
                <div key={section}>
                  <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14, fontFamily: "'DM Mono', monospace" }}>
                    {section}
                  </p>
                  {links.map(l => (
                    <Link key={l.href} to={l.href}
                      style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none", marginBottom: 8, lineHeight: 1.4 }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#fff"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"}>
                      {l.label}
                    </Link>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
                © {new Date().getFullYear()} AdBrief. All rights reserved.
              </p>
              <div style={{ display: "flex", gap: 20 }}>
                {[["Privacy", "/privacy"], ["Terms", "/terms"]].map(([l, h]) => (
                  <Link key={h} to={h} style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", textDecoration: "none" }}>{l}</Link>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
