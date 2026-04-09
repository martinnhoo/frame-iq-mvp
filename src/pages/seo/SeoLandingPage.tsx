import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;
const m = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as React.CSSProperties;

interface FAQ { q: string; a: string; }
interface SeoLandingPageProps {
  metaTitle: string; metaDescription: string; canonical: string;
  badge?: string; headline: string; subheadline: string; intro: string;
  useCases?: string[]; faqs?: FAQ[]; relatedLinks?: { label: string; href: string }[];
  accentColor?: string;
}

export default function SeoLandingPage({ metaTitle, metaDescription, canonical, badge, headline, subheadline, intro, useCases = [], faqs = [], relatedLinks = [], accentColor = "#0ea5e9" }: SeoLandingPageProps) {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", background: "#080810", color: "rgba(255,255,255,0.85)" }}>
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={`https://www.adbrief.pro${canonical}`} />
      <nav style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link to="/" style={{ ...j, fontWeight: 800, fontSize: 18, color: "#fff", textDecoration: "none" }}>adbrief</Link>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => navigate("/login")} style={{ ...j, padding: "8px 16px", borderRadius: 999, fontSize: 13, background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>Sign in</button>
          <button onClick={() => navigate("/signup")} style={{ ...j, padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg,${accentColor},#06b6d4)`, color: "#000", border: "none", cursor: "pointer" }}>Try free</button>
        </div>
      </nav>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "64px 24px 80px" }}>
        {badge && <p style={{ ...m, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: accentColor, marginBottom: 16 }}>{badge}</p>}
        <h1 style={{ ...j, fontSize: 38, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 16 }}>{headline}</h1>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 32 }}>{subheadline}</p>
        <div style={{ display: "flex", gap: 12, marginBottom: 48 }}>
          <button onClick={() => navigate("/signup")} style={{ ...j, padding: "13px 28px", borderRadius: 999, fontSize: 14, fontWeight: 700, background: `linear-gradient(135deg,${accentColor},#06b6d4)`, color: "#000", border: "none", cursor: "pointer" }}>Try free for 3 days</button>
          <button onClick={() => navigate("/pricing")} style={{ ...j, padding: "13px 22px", borderRadius: 999, fontSize: 14, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>See pricing</button>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 40 }} />
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.85, marginBottom: 40 }}>{intro}</p>
        {useCases.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ ...j, fontSize: 22, fontWeight: 700, marginBottom: 16 }}>What you can do with it</h2>
            {useCases.map(uc => (
              <div key={uc} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <span style={{ color: accentColor, flexShrink: 0 }}>✓</span>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{uc}</p>
              </div>
            ))}
          </div>
        )}
        {faqs.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ ...j, fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Frequently Asked Questions</h2>
            <script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) })}</script>
            {faqs.map(faq => (
              <details key={faq.q} style={{ background: "#090910", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px", marginBottom: 4 }}>
                <summary style={{ ...j, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", listStyle: "none", display: "flex", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>{faq.q}<span style={{ color: accentColor, flexShrink: 0 }}>+</span></summary>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginTop: 12 }}>{faq.a}</p>
              </details>
            ))}
          </div>
        )}
        {relatedLinks.length > 0 && (
          <div style={{ borderRadius: 16, padding: 18, background: "#090910", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 32 }}>
            <p style={{ ...m, fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 12 }}>Related</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {relatedLinks.map(l => <button key={l.href} onClick={() => navigate(l.href)} style={{ fontSize: 13, padding: "7px 14px", borderRadius: 20, background: `${accentColor}12`, color: accentColor, border: `1px solid ${accentColor}22`, cursor: "pointer" }}>{l.label}</button>)}
            </div>
          </div>
        )}
        <div style={{ borderRadius: 20, padding: "32px 28px", textAlign: "center", background: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.05))", border: "1px solid rgba(139,92,246,0.15)" }}>
          <h3 style={{ ...j, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Ready to improve your ad creative?</h3>
          <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 20, fontSize: 14 }}>3-day free trial on all plans. Card required, no charge for 24h.</p>
          <button onClick={() => navigate("/signup")} style={{ ...j, padding: "13px 28px", borderRadius: 999, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000", border: "none", cursor: "pointer" }}>Start free →</button>
        </div>
      </div>
    </div>
  );
}
