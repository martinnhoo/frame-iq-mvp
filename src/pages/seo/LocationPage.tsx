import { useParams, useNavigate } from "react-router-dom";
import { SEO_MARKET_PAGES } from "@/data/seoData";
import SeoLandingPage from "./SeoLandingPage";

export default function LocationPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const page = SEO_MARKET_PAGES.find(p => p.slug === slug);
  if (!page) return <div style={{textAlign:"center",padding:"120px 24px",color:"rgba(255,255,255,0.3)"}}>Page not found. <button onClick={() => navigate("/")} style={{color:"#0ea5e9",background:"none",border:"none",cursor:"pointer"}}>← Home</button></div>;
  return (
    <SeoLandingPage
      metaTitle={page.metaTitle}
      metaDescription={page.metaDescription}
      canonical={"/markets/" + slug}
      badge={(page as any)["location"] || undefined}
      headline={page.headline}
      subheadline={page.subheadline}
      intro={page.intro}
      useCases={(page as any).useCases}
      faqs={page.faqs}
      accentColor="#38bdf8"
      relatedLinks={[
        { label: "Ad Creative Analyzer", href: "/tools/ad-creative-analyzer" },
        { label: "Hook Generator", href: "/tools/ad-hook-generator" },
        { label: "Script Generator", href: "/tools/ad-script-generator" },
      ]}
    />
  );
}
