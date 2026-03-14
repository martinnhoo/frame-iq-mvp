import { useNavigate } from "react-router-dom";
import { SeoLayout } from "@/components/seo/SeoLayout";
import { SeoCTA } from "@/components/seo/SeoCTA";
import { SEO_TOOLS } from "@/data/seoData";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const m = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" };
const typeColor: Record<string, string> = { generator: "#fb923c", analyzer: "#22d3ee", calculator: "#34d399" };

export default function ToolsIndex() {
  const navigate = useNavigate();
  return (
    <SeoLayout title="Free Ad Creative Tools — AdBrief" description="Free AI tools for performance marketers: hook generator, creative analyzer, script generator, competitor decoder, CTR estimator." canonical="/tools">
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "64px 24px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{ ...m, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>Free Tools</p>
          <h1 style={{ ...j, fontSize: 44, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 14 }}>
            AI tools for better<br />
            <span style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ad creatives</span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
            Built for performance marketers and media buyers. No credit card required.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16, marginBottom: 16 }}>
          {SEO_TOOLS.map(tool => (
            <div key={tool.slug} onClick={() => navigate(`/tools/${tool.slug}`)}
              style={{ background: "#090910", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 24, cursor: "pointer", transition: "border-color .15s, transform .12s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: `${typeColor[tool.type] ?? "#0ea5e9"}15`, border: `1px solid ${typeColor[tool.type] ?? "#0ea5e9"}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{tool.emoji}</div>
                {tool.isFree && <span style={{ ...m, fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>FREE</span>}
              </div>
              <h2 style={{ ...j, fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>{tool.name}</h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, marginBottom: 16 }}>{tool.description}</p>
              <div style={{ fontSize: 12, color: "#0ea5e9", fontWeight: 600 }}>Try it free →</div>
            </div>
          ))}
        </div>
        <SeoCTA />
      </div>
    </SeoLayout>
  );
}
