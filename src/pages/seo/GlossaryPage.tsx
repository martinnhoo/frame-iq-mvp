import { useParams, useNavigate } from "react-router-dom";
import { SEO_LEARN_PAGES } from "@/data/seoData";
import SeoLandingPage from "./SeoLandingPage";

export default function GlossaryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const page = SEO_LEARN_PAGES.find(p => p.slug === slug);
  if (!page) return <div style={{textAlign:"center",padding:"120px 24px",color:"rgba(255,255,255,0.3)"}}>Page not found. <button onClick={() => navigate("/")} style={{color:"#a78bfa",background:"none",border:"none",cursor:"pointer"}}>← Home</button></div>;
  return (
    <SeoLandingPage
      metaTitle={page.metaTitle}
      metaDescription={page.metaDescription}
      canonical={"/glossary/" + slug}
      badge={(page as any)[""] || undefined}
      headline={page.headline}
      subheadline={page.subheadline}
      intro={page.intro}
      useCases={(page as any).useCases}
      faqs={page.faqs}
      accentColor="#e879f9"
      relatedLinks={[
        { label: "Ad Creative Analyzer", href: "/tools/ad-creative-analyzer" },
        { label: "Hook Generator", href: "/tools/ad-hook-generator" },
        { label: "Script Generator", href: "/tools/ad-script-generator" },
      ]}
    />
  );
}
