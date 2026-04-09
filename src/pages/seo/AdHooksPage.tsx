import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SeoLayout } from "@/components/seo/SeoLayout";
import { SeoCTA } from "@/components/seo/SeoCTA";
import { SEO_HOOKS } from "@/data/seoData";

const j = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const m = { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };

const HOOK_EXAMPLES: Record<string, { score: number; text: string; platform: string; industry: string }[]> = {
  "curiosity": [
    { score: 9.1, text: "I tried posting ads on TikTok every day for 30 days. Here's what nobody tells you.", platform: "TikTok", industry: "SaaS" },
    { score: 8.7, text: "The reason 90% of Facebook ads fail in the first 3 seconds (and how to fix it).", platform: "Facebook", industry: "E-commerce" },
    { score: 8.4, text: "What if I told you the hook you're writing is the reason you're losing money?", platform: "TikTok", industry: "Marketing" },
  ],
  "social-proof": [
    { score: 9.3, text: "47,000 media buyers switched to this in the last 6 months.", platform: "Facebook", industry: "SaaS" },
    { score: 8.9, text: "This brand went from $2K to $200K/month. Here's the exact creative formula.", platform: "TikTok", industry: "E-commerce" },
    { score: 8.5, text: "Over 12,000 5-star reviews. And it's not what you think it is.", platform: "Instagram", industry: "Beauty" },
  ],
  "transformation": [
    { score: 9.0, text: "I was burning $5K/month on ads that didn't convert. Then I fixed this one thing.", platform: "TikTok", industry: "SaaS" },
    { score: 8.8, text: "From 0 to 120,000 monthly visitors in 8 months. No paid search.", platform: "Facebook", industry: "Marketing" },
    { score: 8.3, text: "I lost 18kg in 4 months without a gym membership. Here's everything I did.", platform: "TikTok", industry: "Health" },
  ],
  "fear": [
    { score: 8.9, text: "If you're still running ads without a hook score, you're wasting money right now.", platform: "TikTok", industry: "Marketing" },
    { score: 8.6, text: "The TikTok algorithm change that killed 60% of DTC brands' ROAS last quarter.", platform: "Facebook", industry: "E-commerce" },
    { score: 8.2, text: "Most casino ads get banned in the first week. Here's why — and how to avoid it.", platform: "TikTok", industry: "iGaming" },
  ],
  "pattern-interrupt": [
    { score: 9.4, text: "[Silence. Product smashes into frame. Text: 'We're done with boring ads.']", platform: "TikTok", industry: "Fashion" },
    { score: 8.9, text: "[Loud record scratch. Creator freezes.] 'Wait. Before you keep scrolling.'", platform: "TikTok", industry: "E-commerce" },
    { score: 8.7, text: "[Whisper, leaning close to camera] 'I'm not supposed to be showing you this.'", platform: "Instagram", industry: "Finance" },
  ],
  "question": [
    { score: 8.8, text: "Are you still paying $149/month for an ad spy tool that doesn't tell you WHY the ad works?", platform: "Facebook", industry: "SaaS" },
    { score: 8.5, text: "What would you do with 2 extra hours a day? Because that's what this saves our users.", platform: "TikTok", industry: "Productivity" },
    { score: 8.3, text: "Is your hook score below 6? That's why your ads aren't converting.", platform: "TikTok", industry: "Marketing" },
  ],
  "storytelling": [
    { score: 9.0, text: "3 months ago I almost quit running ads altogether. Then one change saved everything.", platform: "TikTok", industry: "E-commerce" },
    { score: 8.7, text: "My client called me at 11pm. 'The campaign is tanking.' I found the problem in 60 seconds.", platform: "Facebook", industry: "Agency" },
    { score: 8.4, text: "She bet me $100 I couldn't make an ad that converts cold traffic. I made $12K in 48 hours.", platform: "TikTok", industry: "DTC" },
  ],
  "direct-offer": [
    { score: 9.2, text: "Get your hook score in 60 seconds — or the analysis is free forever.", platform: "Facebook", industry: "SaaS" },
    { score: 8.8, text: "First 100 signups this week get lifetime access. 73 spots left.", platform: "TikTok", industry: "SaaS" },
    { score: 8.5, text: "Ship a working video ad in 48 hours. Or we rewrite it for free.", platform: "Instagram", industry: "Agency" },
  ],
};

const scoreColor = (s: number) => s >= 9 ? "#34d399" : s >= 8 ? "#0ea5e9" : "#fbbf24";
const scoreLabel = (s: number) => s >= 9 ? "Viral" : s >= 8 ? "High" : "Medium";

export default function AdHooksPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState(SEO_HOOKS[0].slug);
  const activeHook = SEO_HOOKS.find(h => h.slug === active)!;
  const examples = HOOK_EXAMPLES[activeHook.type] ?? [];

  return (
    <SeoLayout
      title="Best Ad Hooks — Scored & Categorized | AdBrief"
      description="Browse 50+ high-performing ad hooks organized by type. Hook scores, examples, and why they work. Free by AdBrief."
      canonical="/best-ad-hooks"
    >
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "64px 24px 0" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <p style={{ ...m, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>Ad Hooks Library</p>
          <h1 style={{ ...j, fontSize: 44, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.1, marginBottom: 14 }}>
            The hooks that<br />
            <span style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>stop the scroll</span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
            Organized by hook type, scored by AI. Use them as inspiration — or generate your own in seconds.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, alignItems: "start" }}>
          {/* Sidebar — hook types */}
          <div style={{ position: "sticky", top: 80 }}>
            {SEO_HOOKS.map(h => (
              <button key={h.slug} onClick={() => setActive(h.slug)}
                style={{ ...j, width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, fontSize: 13, fontWeight: active === h.slug ? 700 : 500, background: active === h.slug ? "rgba(14,165,233,0.12)" : "transparent", color: active === h.slug ? "#0ea5e9" : "rgba(255,255,255,0.45)", border: `1px solid ${active === h.slug ? "rgba(14,165,233,0.3)" : "transparent"}`, cursor: "pointer", marginBottom: 4, transition: "all .15s" }}>
                <span style={{ fontSize: 16 }}>{h.emoji}</span>
                {h.label}
              </button>
            ))}
          </div>

          {/* Main content */}
          <div>
            <div style={{ marginBottom: 28, padding: "20px 22px", borderRadius: 18, background: "#090910", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ ...j, fontSize: 19, fontWeight: 700, marginBottom: 8 }}>{activeHook.emoji} {activeHook.label}</p>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{activeHook.description}</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {examples.map((ex, i) => (
                <div key={i} style={{ padding: "20px 22px", borderRadius: 18, background: "#090910", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: `${scoreColor(ex.score)}15`, border: `1px solid ${scoreColor(ex.score)}30` }}>
                      <span style={{ ...m, fontSize: 13, fontWeight: 700, color: scoreColor(ex.score) }}>{ex.score}</span>
                      <span style={{ fontSize: 12, color: scoreColor(ex.score), opacity: 0.7 }}>{scoreLabel(ex.score)}</span>
                    </div>
                    <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{ex.platform}</span>
                    <span style={{ ...m, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{ex.industry}</span>
                  </div>
                  <p style={{ ...j, fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, fontStyle: ex.text.startsWith("[") ? "italic" : "normal" }}>
                    "{ex.text}"
                  </p>
                </div>
              ))}
            </div>

            {/* Generate CTA */}
            <div style={{ marginTop: 20, padding: "20px 22px", borderRadius: 18, background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.18)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <p style={{ ...j, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                Generate {activeHook.label.toLowerCase()} for your own product →
              </p>
              <button onClick={() => navigate("/tools/ad-hook-generator")}
                style={{ ...j, padding: "9px 20px", borderRadius: 999, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#000", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                Hook Generator (free)
              </button>
            </div>
          </div>
        </div>

        <SeoCTA headline="Score your own hook" sub="Paste any hook into our analyzer and get a score, platform fit, and suggestions — in seconds." primaryLabel="Try it free" />
      </div>
    </SeoLayout>
  );
}
