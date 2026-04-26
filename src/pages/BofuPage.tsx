/**
 * BofuPage — React-rendered version of the static BOFU SEO pages.
 *
 * Mirrors the content emitted by `scripts/prerender.mjs` so that:
 *   - Crawlers receive static HTML directly (prerendered file at /<slug>/index.html)
 *   - Users navigating client-side see the same content rendered by React
 *     with the full app shell (Helmet for meta tags, layout, etc.)
 *
 * If the slug doesn't match any known BOFU page, redirects to NotFound.
 */
import { useLocation, Navigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { getBofuPageBySlug } from "@/data/bofuPages";

export default function BofuPage() {
  // Routes are mounted at literal paths like `/auditoria-meta-ads-ia` (not
  // `/:slug`), so derive the slug from the current pathname instead of params.
  const location = useLocation();
  const slug = location.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  const page = getBofuPageBySlug(slug);

  if (!page) return <Navigate to="/404" replace />;

  const url = `https://adbrief.pro/${page.slug}`;

  return (
    <>
      <Helmet>
        <title>{page.title}</title>
        <meta name="description" content={page.description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={page.title} />
        <meta property="og:description" content={page.description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta name="twitter:title" content={page.title} />
        <meta name="twitter:description" content={page.description} />
      </Helmet>

      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg, #0A0F1C 0%, #0E1320 100%)",
          color: "#F0F6FC",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Top nav — minimal, links back to landing + signup */}
        <header
          style={{
            padding: "20px clamp(20px, 4vw, 48px)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Link
            to="/"
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#F0F6FC",
              textDecoration: "none",
              letterSpacing: "-0.02em",
            }}
          >
            adbrief
          </Link>
          <nav style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <Link to="/pricing" style={navLinkStyle}>
              Preços
            </Link>
            <Link to="/faq" style={navLinkStyle}>
              FAQ
            </Link>
            <Link to="/login" style={navLinkStyle}>
              Login
            </Link>
            <Link to="/signup" style={ctaButtonStyle}>
              Teste grátis
            </Link>
          </nav>
        </header>

        {/* Article content */}
        <main
          style={{
            maxWidth: 780,
            margin: "0 auto",
            padding: "48px clamp(20px, 4vw, 32px)",
            lineHeight: 1.65,
          }}
        >
          <h1
            style={{
              fontSize: "clamp(28px, 4.4vw, 42px)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              margin: "0 0 16px",
              color: "#F0F6FC",
              lineHeight: 1.18,
            }}
          >
            {page.h1}
          </h1>
          <p
            style={{
              fontSize: 18,
              color: "rgba(240,246,252,0.72)",
              margin: "0 0 32px",
              lineHeight: 1.5,
            }}
          >
            {page.description}
          </p>

          <div
            className="bofu-body"
            style={{
              fontSize: 16,
              color: "rgba(240,246,252,0.85)",
            }}
            // The bodyHTML is authored by us in src/data/bofuPages.ts (not user-supplied).
            // No injection risk; React requires the dangerouslySetInnerHTML opt-in.
            dangerouslySetInnerHTML={{ __html: page.bodyHTML }}
          />

          {/* CTA */}
          <div style={{ margin: "40px 0" }}>
            <Link
              to="/signup"
              style={{
                display: "inline-block",
                background: "#2563EB",
                color: "#fff",
                padding: "14px 28px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
                letterSpacing: "-0.005em",
                boxShadow: "0 0 24px rgba(37,99,235,0.25)",
              }}
            >
              Começar teste grátis de 3 dias →
            </Link>
          </div>

          {/* Related */}
          {page.related && page.related.length > 0 && (
            <section
              style={{
                marginTop: 56,
                paddingTop: 32,
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "rgba(240,246,252,0.72)",
                  margin: "0 0 16px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Conteúdo relacionado
              </h2>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "grid",
                  gap: 8,
                }}
              >
                {page.related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      to={`/${r.slug}`}
                      style={{
                        color: "#60A5FA",
                        textDecoration: "none",
                        fontSize: 15,
                      }}
                    >
                      → {r.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>

        {/* Footer */}
        <footer
          style={{
            padding: "32px clamp(20px, 4vw, 48px)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(240,246,252,0.42)",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          AdBrief © 2026 · IA pra Meta Ads em português ·{" "}
          <Link to="/privacy" style={{ color: "rgba(240,246,252,0.6)" }}>
            Privacidade
          </Link>{" "}
          ·{" "}
          <Link to="/terms" style={{ color: "rgba(240,246,252,0.6)" }}>
            Termos
          </Link>
        </footer>
      </div>

      <style>{`
        .bofu-body h2 {
          font-size: 22px;
          font-weight: 700;
          margin: 32px 0 12px;
          color: #F0F6FC;
          letter-spacing: -0.01em;
        }
        .bofu-body p { margin: 0 0 16px; }
        .bofu-body ul, .bofu-body ol {
          margin: 0 0 20px;
          padding-left: 24px;
        }
        .bofu-body li { margin: 0 0 8px; line-height: 1.55; }
        .bofu-body strong { color: #F0F6FC; font-weight: 600; }
        .bofu-body a { color: #60A5FA; text-decoration: none; }
        .bofu-body a:hover { text-decoration: underline; }
      `}</style>
    </>
  );
}

const navLinkStyle: React.CSSProperties = {
  color: "rgba(240,246,252,0.72)",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 500,
};

const ctaButtonStyle: React.CSSProperties = {
  background: "#2563EB",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: 8,
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};
