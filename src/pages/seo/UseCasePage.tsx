import { useParams, useNavigate } from "react-router-dom";
import { SEO_USECASE_PAGES } from "@/data/seoData";
import { findUseCaseBySlug } from "@/data/seoData";
import SeoLandingPage from "./SeoLandingPage";

export default function UseCasePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const page = findUseCaseBySlug(slug!);
  if (!page) return <div style={{textAlign:"center",padding:"120px 24px",color:"rgba(255,255,255,0.3)"}}>Page not found. <button onClick={() => navigate("/")} style={{color:"#0ea5e9",background:"none",border:"none",cursor:"pointer"}}>← Home</button></div>;
  return (
    <SeoLandingPage
      metaTitle={page.metaTitle}
      metaDescription={page.metaDescription}
      canonical={"/use-case/" + slug}
      badge={(page as any)[""] || undefined}
      headline={page.headline}
      subheadline={page.subheadline}
      intro={page.intro}
      useCases={(page as any).useCases}
      faqs={page.faqs}
      accentColor="#34d399"
      relatedLinks={[
        { label: "Ad Creative Analyzer", href: "/tools/ad-creative-analyzer" },
        { label: "Hook Generator", href: "/tools/ad-hook-generator" },
        { label: "Script Generator", href: "/tools/ad-script-generator" },
      ]}
    />
  );
}
