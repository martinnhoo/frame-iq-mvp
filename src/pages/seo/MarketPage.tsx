import { useParams, useNavigate } from "react-router-dom";
import SeoLandingPage from "./SeoLandingPage";
import { SeoLayout } from "@/components/seo/SeoLayout";
import { SEO_MARKET_PAGES } from "@/data/seoData";

export default function MarketPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const page = SEO_MARKET_PAGES.find(p => p.slug === slug);

  if (!page) return (
    <SeoLayout title="Not Found — AdBrief" description="" noIndex>
      <div style={{ textAlign: "center", padding: "120px 24px" }}>
        <p style={{ color: "rgba(255,255,255,0.3)" }}>Page not found.</p>
        <button onClick={() => navigate("/")} style={{ color: "#0ea5e9", background: "none", border: "none", cursor: "pointer", marginTop: 12 }}>← Back</button>
      </div>
    </SeoLayout>
  );

  return (
    <SeoLandingPage
      metaTitle={page.metaTitle}
      metaDescription={page.metaDescription}
      canonical={`/markets/${slug}`}
      badge={(page as any).platformLabel || (page as any).industryLabel || (page as any).roleLabel || (page as any).locationLabel || (page as any).hookTypeLabel}
      headline={page.headline}
      subheadline={page.subheadline}
      intro={page.intro}
      useCases={(page as any).useCases}
      faqs={page.faqs}
      relatedLinks={[{ label: "Script Generator", href: "/tools/ad-script-generator" }, { label: "UGC Scripts", href: "/use-case/ugc-script-generator" }, { label: "Hook Generator", href: "/tools/ad-hook-generator" }]}
      accentColor="#38bdf8"
    />
  );
}
