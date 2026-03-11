import { useState, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Clock, ArrowRight, Layers, ChevronLeft, ChevronRight as ChevronRightIcon, Globe, X, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useObT } from "@/i18n/onboardingTranslations";
import { getTemplateTranslation, getCategoryLabel, getUpgradeCTA } from "@/i18n/templateTranslations";

type Category = string;
type Duration = "all" | "15" | "30" | "60";

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  duration: 15 | 30 | 60;
  prompt: string;
}

const LANGUAGES = [
  { code: "en", flag: "🇺🇸", name: "English",    market: "US / Global" },
  { code: "pt", flag: "🇧🇷", name: "Português",  market: "Brazil" },
  { code: "es", flag: "🇲🇽", name: "Español",    market: "MX / LATAM" },
  { code: "hi", flag: "🇮🇳", name: "Hindi",      market: "India" },
  { code: "fr", flag: "🇫🇷", name: "Français",   market: "France / CA" },
  { code: "de", flag: "🇩🇪", name: "Deutsch",    market: "Germany" },
  { code: "it", flag: "🇮🇹", name: "Italiano",   market: "Italy" },
  { code: "ar", flag: "🇸🇦", name: "عربي",       market: "MENA" },
  { code: "zh", flag: "🇨🇳", name: "中文",        market: "China" },
  { code: "ja", flag: "🇯🇵", name: "日本語",      market: "Japan" },
  { code: "ko", flag: "🇰🇷", name: "한국어",      market: "Korea" },
  { code: "tr", flag: "🇹🇷", name: "Türkçe",     market: "Turkey" },
  { code: "ru", flag: "🇷🇺", name: "Русский",    market: "Russia" },
  { code: "nl", flag: "🇳🇱", name: "Nederlands", market: "Netherlands" },
  { code: "id", flag: "🇮🇩", name: "Bahasa",     market: "Indonesia" },
  { code: "th", flag: "🇹🇭", name: "ภาษาไทย",   market: "Thailand" },
  { code: "vi", flag: "🇻🇳", name: "Tiếng Việt", market: "Vietnam" },
  { code: "pl", flag: "🇵🇱", name: "Polski",     market: "Poland" },
];

interface TranslateModalProps {
  template: Template;
  onClose: () => void;
  onUse: (template: Template, translatedPrompt?: string, lang?: string) => void;
  userId: string;
}

const TranslateModal = ({ template, onClose, onUse, userId }: TranslateModalProps) => {
  const [selectedLang, setSelectedLang] = useState("en");
  const [adLang, setAdLang] = useState("en"); // language the ad itself will be in
  const [translating, setTranslating] = useState(false);
  const [preview, setPreview] = useState<{ text: string; notes: string } | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [adLangOpen, setAdLangOpen] = useState(false);

  const lang = LANGUAGES.find(l => l.code === selectedLang)!;
  const adLangData = LANGUAGES.find(l => l.code === adLang)!;

  const handleTranslate = async () => {
    setTranslating(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("translate-text", {
        body: {
          source_text: template.prompt,
          from_language: "en",
          from_language_name: "English",
          to_language: selectedLang,
          to_language_name: lang.name,
          context: `Ad script template: "${template.name}". Ad will target the ${lang.market} market. The ad dialogue/VO will be in ${adLangData.name}.`,
          tone: "Aggressive / Urgent",
          user_id: userId,
        },
      });
      if (error) throw error;
      setPreview({
        text: data.translated_text || data.translation?.translated_text || template.prompt,
        notes: data.cultural_adaptation || "",
      });
    } catch {
      toast.error("Translation failed — check API key");
    } finally {
      setTranslating(false);
    }
  };

  const handleUseTranslated = () => {
    onUse(template, preview?.text, selectedLang);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/[0.1] bg-[#0a0a0a] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Globe className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white" style={{ fontFamily: "'Syne',sans-serif" }}>Translate template</p>
              <p className="text-[11px] text-white/30">{template.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/30 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Target market */}
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2" style={{ fontFamily: "'DM Mono',monospace" }}>Target market</p>
              <div className="relative">
                <button onClick={() => setLangOpen(o => !o)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] text-white text-sm transition-all">
                  <span className="text-base">{lang.flag}</span>
                  <span className="flex-1 text-left font-medium">{lang.name}</span>
                  <ChevronDown className="h-3 w-3 text-white/30" />
                </button>
                {langOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
                    <div className="absolute top-full mt-1 left-0 z-20 rounded-2xl border border-white/[0.08] shadow-2xl p-2 w-56 max-h-60 overflow-y-auto" style={{ background: "#0d0d0d" }}>
                      {LANGUAGES.map(l => (
                        <button key={l.code} onClick={() => { setSelectedLang(l.code); setLangOpen(false); setPreview(null); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${l.code === selectedLang ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/[0.06]"}`}>
                          <span>{l.flag}</span>
                          <span className="flex-1 text-left">{l.name}</span>
                          <span className="text-white/20 text-[10px]">{l.market}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2" style={{ fontFamily: "'DM Mono',monospace" }}>Ad language (VO)</p>
              <div className="relative">
                <button onClick={() => setAdLangOpen(o => !o)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] text-white text-sm transition-all">
                  <span className="text-base">{adLangData.flag}</span>
                  <span className="flex-1 text-left font-medium">{adLangData.name}</span>
                  <ChevronDown className="h-3 w-3 text-white/30" />
                </button>
                {adLangOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAdLangOpen(false)} />
                    <div className="absolute top-full mt-1 left-0 z-20 rounded-2xl border border-white/[0.08] shadow-2xl p-2 w-56 max-h-60 overflow-y-auto" style={{ background: "#0d0d0d" }}>
                      {LANGUAGES.map(l => (
                        <button key={l.code} onClick={() => { setAdLang(l.code); setAdLangOpen(false); setPreview(null); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${l.code === adLang ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/[0.06]"}`}>
                          <span>{l.flag}</span>
                          <span className="flex-1 text-left">{l.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          {preview ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2" style={{ fontFamily: "'DM Mono',monospace" }}>Translated brief</p>
                <p className="text-xs text-white/60 leading-relaxed">{preview.text}</p>
              </div>
              {preview.notes && (
                <div className="rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400/50 mb-1" style={{ fontFamily: "'DM Mono',monospace" }}>Cultural adaptation</p>
                  <p className="text-[11px] text-white/35 leading-relaxed">{preview.notes}</p>
                </div>
              )}
              <button onClick={handleUseTranslated}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-black font-bold text-sm hover:bg-white/90 transition-all" style={{ fontFamily: "'Syne',sans-serif" }}>
                {lang.flag} Use this translated template <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button onClick={handleTranslate} disabled={translating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-sm hover:bg-emerald-500/20 disabled:opacity-40 transition-all" style={{ fontFamily: "'Syne',sans-serif" }}>
              {translating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Adapting for {lang.market}...</>
                : <><Sparkles className="h-4 w-4" /> Adapt for {lang.flag} {lang.name} market</>}
            </button>
          )}

          {/* Skip */}
          <button onClick={() => { onUse(template); onClose(); }}
            className="w-full text-center text-xs text-white/20 hover:text-white/40 transition-colors py-1">
            Skip translation — use original in English →
          </button>
        </div>
      </div>
    </div>
  );
};

const T = (id: string, name: string, description: string, category: string, duration: 15 | 30 | 60, prompt: string): Template =>
  ({ id, name, description, category, duration, prompt });

const TEMPLATES: Template[] = [
  T("ugc-direct-hook", "UGC Direct Hook", "Creator speaks to camera with bold opening.", "ugc", 30,
    `UGC-style ad. Scene 1 (0-3s): Bold hook. Scene 2 (4-10s): Relatable pain. Scene 3 (11-20s): Product intro + solution. Scene 4 (21-27s): Quick demo. Scene 5 (28-30s): CTA. Tone: Authentic, conversational.`),
  T("ugc-day-in-life", "Day in My Life", "Creator shows routine featuring product naturally.", "ugc", 60,
    `Day-in-life UGC. Scene 1 (0-4s): Morning hook — show relatable chaos. Scene 2 (5-20s): Routine moments featuring product organically. Scene 3 (21-50s): Key benefit revealed naturally. Scene 4 (51-60s): CTA. Tone: Real, unfiltered.`),
  T("ugc-unboxing", "Unboxing Reaction", "Authentic first-impression unboxing.", "ugc", 30,
    `UGC unboxing. Scene 1 (0-3s): Package arrives — genuine excitement. Scene 2 (4-15s): Unboxing step by step. Scene 3 (16-25s): First impression + key features. Scene 4 (26-30s): CTA. Tone: Surprise, delight.`),
  T("ugc-3am", "3AM Problem", "Creator reveals they discovered product at 3am.", "ugc", 15,
    `UGC 3AM hook. Scene 1 (0-3s): Dark room, creator: 'it's 3am and I just found this'. Scene 2 (4-10s): Quick problem reveal. Scene 3 (11-13s): Product flash. Scene 4 (14-15s): Text CTA. Fast pacing.`),
  T("ugc-walk-talk", "Walk and Talk", "Creator walks while talking about product.", "ugc", 30,
    `Walk-and-talk UGC. Handheld, outdoor. Scene 1 (0-3s): Walking, casual hook. Scene 2 (4-20s): Talking about product benefits like chatting to friend. Scene 3 (21-27s): Show product in hand. Scene 4 (28-30s): CTA.`),
  T("ugc-myth", "Myth Busting", "Creator debunks common myths.", "ugc", 60,
    `Myth-busting UGC. Scene 1: 'Stop believing this about [category]'. Scene 2-4: Debunk 3 myths one by one. Scene 5: Product as the truth. Scene 6: CTA. Tone: Authoritative but friendly.`),
  T("ugc-transformation", "Before vs After", "Creator shows transformation with product.", "ugc", 30,
    `UGC transformation. Split reveal. Scene 1 (0-3s): 'Before' state — pain point. Scene 2 (4-20s): Process with product. Scene 3 (21-28s): After reveal. Scene 4 (29-30s): CTA. Emotional tone.`),
  T("ugc-honest-review", "Honest Review", "Creator gives brutally honest product take.", "ugc", 60,
    `Honest review UGC. Scene 1: 'I'm going to be real about this product'. Scene 2: What's not perfect. Scene 3: What genuinely works. Scene 4: Who it's for. Scene 5: Final verdict + CTA. Trust-building tone.`),
  T("ugc-gift", "Gift Reaction", "Gifted product, genuine reaction.", "ugc", 15,
    `Gift reaction UGC. Scene 1: Receiving gift, genuine surprise. Scene 2: Open it, first reaction. Scene 3: Quick benefit mention. Scene 4: CTA overlay. Fast, emotional.`),
  T("ugc-duet", "Duet Response", "Creator responds to another video mentioning product.", "ugc", 30,
    `Duet-style UGC. Left side: common complaint or question video. Right side: creator responding with product solution. Natural conversational tone. CTA at end.`),
  T("ugc-challenge", "Challenge Style", "Creator does a challenge using product.", "ugc", 15,
    `Challenge-style UGC. Hook: '7-day [challenge] using only [product]'. Quick day montage. Result reveal. CTA. High energy, music-driven.`),
  T("ugc-comparison", "I Tried 5 Products", "Creator tested competitors, picked this one.", "ugc", 60,
    `Comparison UGC. Scene 1: 'I bought 5 [products] so you don't have to'. Scene 2: Show all products. Scene 3: Test each one quickly. Scene 4: The winner reveal. Scene 5: Why this one wins. CTA.`),
  T("ugc-stitch", "Stitch Hook", "Creator stitches a viral clip to introduce product.", "ugc", 30,
    `Stitch UGC. Open with stitched clip (5s of viral content). Creator reacts: 'Wait, this is exactly why I use [product]'. Quick demo. CTA.`),
  T("ugc-get-ready", "Get Ready With Me", "Creator gets ready while talking about product.", "ugc", 60,
    `GRWM UGC. Morning routine, creator talks while getting ready. Product featured naturally in the routine. Intimate, personal tone. CTA at end.`),
  T("ugc-mistake", "I Made a Mistake", "Creator admits mistake that product fixes.", "ugc", 30,
    `Mistake confession UGC. Scene 1: 'I made a huge mistake by not using [product] sooner'. Scene 2: The costly mistake story. Scene 3: How product solved it. Scene 4: CTA with urgency.`),
  T("testimonial-customer", "Real Customer Result", "Real customer shares outcome.", "testimonial", 30,
    `Testimonial ad. Real customer (or actor playing one). Scene 1 (0-4s): Result hook — lead with outcome. Scene 2 (5-20s): Story — before state, what they tried, found this. Scene 3 (21-27s): Current result. Scene 4 (28-30s): CTA.`),
  T("testimonial-before-after", "Before/After Testimonial", "Side-by-side transformation story.", "testimonial", 60,
    `Before/after testimonial. Two-part structure. Part 1: Dark times, previous failed attempts. Part 2: Life after product. Emotional, specific details. CTA.`),
  T("testimonial-rapid-fire", "5 Customers 5 Results", "5 quick testimonials edited together.", "testimonial", 30,
    `Rapid-fire social proof. 5 cuts, each 5 seconds. Each customer: name, result in one sentence. Fast edits. Music-driven. End: product + CTA.`),
  T("testimonial-expert", "Expert Endorsement", "Industry expert vouches for product.", "testimonial", 30,
    `Expert testimonial. Scene 1: Expert credential intro. Scene 2: Why they recommend this. Scene 3: Technical credibility. Scene 4: Who should use it. Scene 5: CTA. Professional tone.`),
  T("testimonial-skeptic", "The Skeptic Convert", "Customer who was doubtful but changed mind.", "testimonial", 60,
    `Skeptic-to-believer arc. Scene 1: 'I thought this was a scam'. Scene 2: Why they were skeptical. Scene 3: What made them try it. Scene 4: What happened. Scene 5: Now they recommend it. CTA.`),
  T("testimonial-video-review", "Video Review Style", "Review format with star rating.", "testimonial", 60,
    `Video review format. Screen shows product page/rating. Voice-over reviewer. 5 key criteria rated. Final verdict. CTA. Looks like an organic review.`),
  T("testimonial-interview", "Interview Style", "Interview format Q&A with customer.", "testimonial", 60,
    `Interview testimonial. Two-person setup (interviewer off-camera). Questions: How did you find us? What was your problem? What happened? Would you recommend? Authentic, spontaneous feel.`),
  T("testimonial-stats", "Stats + Proof", "Numbers and data-backed testimonial.", "testimonial", 30,
    `Data-driven testimonial. Scene 1: Big number hook ('$X saved' or 'X% improvement'). Scene 2: Customer explains how. Scene 3: Screenshot or data visual. Scene 4: CTA.`),
  T("testimonial-mom", "Parent Testimonial", "Parent shares how product helps family.", "testimonial", 30,
    `Parent testimonial. Scene 1: Parent with child, warm hook. Scene 2: The problem parents face. Scene 3: How product helped family. Scene 4: Emotional CTA. Warm, trustworthy tone.`),
  T("testimonial-pro", "Professional User", "Professional using product in their work.", "testimonial", 30,
    `Professional testimonial. Scene 1: At work environment. Scene 2: 'As a [profession], I need products that...'. Scene 3: How this product fits professional needs. Scene 4: CTA.`),
  T("testimonial-long", "Long-Form Story", "Full 60s transformation narrative.", "testimonial", 60,
    `Long-form testimonial. Full story arc: life before, turning point, discovery, transformation, life now. Emotional music. Subtle product placement. Powerful CTA.`),
  T("testimonial-mashup", "Comment Mashup", "Real comments/reviews read out loud.", "testimonial", 30,
    `Comment mashup. Creator reads real reviews/comments out loud, reacting. Mix of funny, emotional, surprising. Product shown. CTA. Trust through volume.`),
  T("promo-limited", "Limited Time Offer", "Urgency-driven discount promotion.", "promo", 15,
    `Promo ad. Scene 1 (0-3s): Offer flash — XX% OFF, countdown. Scene 2 (4-10s): What you get. Scene 3 (11-13s): Why now (scarcity). Scene 4 (14-15s): CTA link. High energy, fast cuts.`),
  T("promo-flash-sale", "Flash Sale Announcement", "24-hour sale with extreme urgency.", "promo", 15,
    `Flash sale. Open with alarm/urgency. '24 HOURS ONLY'. Show discount dramatically. What's included. Countdown timer visual. Bold CTA. FOMO-driven.`),
  T("promo-bundle", "Bundle Deal", "Multiple products at combined price.", "promo", 30,
    `Bundle promo. Scene 1: Problem that needs multiple solutions. Scene 2: Introduce each product. Scene 3: 'But what if you could get all 3 for...'. Scene 4: Bundle reveal. Scene 5: CTA.`),
  T("promo-free-trial", "Free Trial Push", "Low-friction free trial offer.", "promo", 15,
    `Free trial promo. Scene 1: Risk objection addressed ('try it free'). Scene 2: What you get in trial. Scene 3: No credit card needed. Scene 4: CTA. Remove all friction.`),
  T("promo-loyalty", "Loyalty Reward", "Exclusive deal for existing community.", "promo", 30,
    `Loyalty promo. 'For our community only'. Exclusive feel. What they get as loyal customer. Limited seats/units. CTA. Exclusivity as value driver.`),
  T("promo-seasonal-sale", "Seasonal Sale", "Holiday/seasonal promotion.", "promo", 30,
    `Seasonal promo. Tie to moment (Black Friday, Summer, New Year). Hook using seasonal emotion. Product + seasonal discount. Urgency. CTA.`),
  T("promo-new-launch", "New Product Launch", "Excitement-driven new release ad.", "promo", 30,
    `Launch promo. Scene 1: Teaser — 'It's finally here'. Scene 2: Build anticipation with features. Scene 3: Reveal. Scene 4: Early access offer. Scene 5: CTA.`),
  T("promo-referral", "Referral Program", "Share and earn promotion.", "promo", 30,
    `Referral promo. Scene 1: 'What if getting [product] was free?'. Scene 2: Explain referral. Scene 3: What they earn. Scene 4: Easy steps. Scene 5: CTA. Win-win framing.`),
  T("promo-waitlist", "Waitlist/Exclusive Access", "Create scarcity with waitlist.", "promo", 15,
    `Waitlist promo. 'Only X spots left'. Show demand (numbers). What they'll get. Why limited. CTA to join waitlist. Exclusivity + FOMO.`),
  T("promo-price-drop", "Price Drop Alert", "Dramatic price reduction announcement.", "promo", 15,
    `Price drop. Open with old price crossed out. New price revealed dramatically. Why price dropped. What's included. CTA. Value shock.`),
  T("promo-gift-card", "Gift Card Push", "Holiday gifting promotion.", "promo", 30,
    `Gift card promo. 'The gift they actually want'. Show gifting moment. Price ranges. How to buy. Send digitally. CTA. Emotional gifting angle.`),
  T("promo-anniversary", "Brand Anniversary Sale", "Milestone celebration promotion.", "promo", 30,
    `Anniversary promo. 'We're celebrating X years'. Thank customers. Special deal as thank you. Limited edition angle. Emotional + promotional.`),
  T("tutorial-howto", "How To Use", "Step-by-step product tutorial.", "tutorial", 60,
    `Tutorial ad. Scene 1 (0-5s): End result hook — show what they'll achieve. Scene 2-5 (6-45s): 4 clear steps. Scene 6 (46-55s): Final result. Scene 7 (56-60s): CTA. Screen recording style or over-shoulder.`),
  T("tutorial-quick", "60-Second Hack", "Quick product tip that feels like a life hack.", "tutorial", 60,
    `Life hack tutorial. Hook: 'This will change how you [do X]'. 3-step process. Each step shown visually. WOW moment. CTA. Educational but promotional.`),
  T("tutorial-mistakes", "5 Mistakes to Avoid", "Negative hook tutorial.", "tutorial", 60,
    `Mistake-avoidance tutorial. Hook: '5 mistakes people make with [category]'. Each mistake shown. How to avoid it (using product). Final tip. CTA.`),
  T("tutorial-setup", "Setup Guide", "Product setup walkthrough.", "tutorial", 60,
    `Setup tutorial. Unboxing to fully working. 5 steps shown clearly. Time stamps style. Voice-over guiding. Professional, reassuring tone. CTA.`),
  T("tutorial-advanced", "Pro Tips", "Advanced user tips to get more value.", "tutorial", 60,
    `Pro tips tutorial. 'If you already have [product], these hacks will blow your mind'. 5 advanced tips. Show each visually. CTA to upgrade or share.`),
  T("tutorial-compare-method", "Old Way vs New Way", "Before/after method comparison.", "tutorial", 30,
    `Method comparison tutorial. Split screen. Left: Old complicated way. Right: New easy way with product. Time comparison. Result quality comparison. CTA.`),
  T("tutorial-recipe", "Recipe/Formula", "Step-by-step formula that includes product.", "tutorial", 60,
    `Recipe-style tutorial. Hook: 'The exact formula for [desired outcome]'. Ingredient list shown. Step-by-step process. Product as key ingredient. Final result. CTA.`),
  T("tutorial-faq", "FAQ Format", "Answers top 5 questions about product.", "tutorial", 60,
    `FAQ tutorial. Host answers 5 most common questions. Each question shown as text on screen. Answer with product demo. Builds trust. CTA.`),
  T("tutorial-hack", "Productivity Hack", "Show unexpected use case.", "tutorial", 30,
    `Unexpected use hack. Hook: 'Nobody talks about using [product] for this'. Unexpected use case revealed. Demo. Mind-blown reaction. CTA.`),
  T("tutorial-checklist", "Checklist Style", "Checklist format for using product correctly.", "tutorial", 30,
    `Checklist tutorial. Clipboard/checklist visual. 5 things to do/check. Each item shown. Product helps complete list. CTA.`),
  T("hook-question", "Question Hook", "Open with provocative question.", "hook", 15,
    `Question hook format. Scene 1 (0-3s): Direct question to viewer — uncomfortable or curiosity-triggering. Scene 2 (4-10s): Product as answer. Scene 3 (11-13s): Proof. Scene 4 (14-15s): CTA.`),
  T("hook-stat", "Shocking Stat", "Lead with surprising data.", "hook", 15,
    `Stat hook. Scene 1: Shocking statistic on screen. Scene 2: Why it matters to viewer. Scene 3: Product as solution. Scene 4: CTA. Visual of stat. Cold, factual tone.`),
  T("hook-story", "Story Hook", "One-line story that pulls you in.", "hook", 30,
    `Story hook. Scene 1: 'Last year I [dramatic event]'. Scene 2: The fall. Scene 3: Discovery of product. Scene 4: The rise. Scene 5: CTA. Narrative arc.`),
  T("hook-pov", "POV Hook", "Point-of-view immersive hook.", "hook", 15,
    `POV hook. 'POV: You just discovered...' First-person camera. Immersive experience of using product. Outcome. CTA text overlay.`),
  T("hook-number", "Number Hook", "Specific number creates curiosity.", "hook", 15,
    `Number hook. Scene 1: Specific number ('I tested 47 products'). Scene 2: The process. Scene 3: Winner reveal. Scene 4: CTA. Numbers = credibility.`),
  T("hook-forbidden", "Forbidden Knowledge", "'They don't want you to know this' angle.", "hook", 30,
    `Forbidden knowledge hook. 'The [industry] doesn't want you to know this'. Reveal the 'secret'. Product as the insider solution. CTA.`),
  T("hook-disagree", "Controversial Take", "Disagree with common belief.", "hook", 30,
    `Controversial hook. 'Hot take: [common advice] is wrong'. Build argument. Product aligns with correct view. CTA. Engagement-driven.`),
  T("hook-transformation", "Transformation Hook", "Visual transformation in first 3 seconds.", "hook", 15,
    `Transformation hook. 0-3s: Shocking before/after visual. Product shown. Quick result explained. CTA. Visual-first, minimal text.`),
  T("hook-warning", "Warning Hook", "Warning format that stops scroll.", "hook", 15,
    `Warning hook. Scene 1: 'WARNING:' text. Concern about common mistake. Product as protection. CTA. Alarm tone but educational.`),
  T("hook-challenge", "Challenge Hook", "Issue a challenge to the viewer.", "hook", 30,
    `Challenge hook. 'I dare you to try [product] for 7 days'. The dare. What will happen. Rules of the challenge. CTA to accept. Competitive framing.`),
  T("product-demo", "Clean Product Demo", "Pure product demonstration.", "product", 30,
    `Product demo. Scene 1 (0-5s): Product hero shot. Scene 2 (6-20s): 3 key features demonstrated. Scene 3 (21-27s): Close-up beauty shot. Scene 4 (28-30s): Brand + CTA. Minimal, premium.`),
  T("product-360", "360 Showcase", "All-angle product view.", "product", 15,
    `360 product showcase. Smooth rotation. Every angle. Key feature callouts as text overlays. Premium lighting. Brand at end. No voice-over.`),
  T("product-comparison", "vs Competitors", "Side-by-side product comparison.", "product", 30,
    `Competitor comparison. Split screen or alternating. Criteria: price, quality, results. Product wins each. Fair but persuasive. CTA.`),
  T("product-close-up", "Macro/Detail Shot", "Beautiful close-up product shots.", "product", 15,
    `Macro beauty ad. Extreme close-up shots. Texture, materials, details. Slow motion moments. Premium music. Minimal text. Brand logo. No CTA needed.`),
  T("product-in-use", "In Context", "Product being used in real environment.", "product", 30,
    `In-use product ad. Product shown being used by real people in real situations. No staged demos. Authentic contexts. Benefits shown not told. CTA.`),
  T("product-packaging", "Unboxing Aesthetic", "Premium packaging reveal.", "product", 30,
    `Packaging unboxing. Premium feel. Scene 1: Box arrives. Scene 2: Slow unboxing — texture, layers. Scene 3: Product reveal. Scene 4: 'This is what premium feels like'. CTA.`),
  T("product-science", "The Science Behind", "Scientific explanation of how it works.", "product", 60,
    `Science explanation. Animated or illustrated. How it works step-by-step. Expert credibility. Results backed by science. CTA.`),
  T("product-features", "Feature Breakdown", "Quick feature showcase.", "product", 30,
    `Feature breakdown. Each feature shown in 5 seconds. Text callout + visual. 5 features total. 'The only [product] you'll ever need'. CTA.`),
  T("product-size", "Size Comparison", "Product scale demonstrated.", "product", 15,
    `Size/scale demo. Common objects for comparison. Surprising size reveal. 'Fits in your [pocket/bag]'. CTA. Practical value.`),
  T("product-materials", "Materials Story", "Premium materials showcase.", "product", 30,
    `Materials story. 'We use [material] because...'. Show material source/quality. Craftsmanship. Why it matters. Premium positioning. CTA.`),
  T("story-brand-origin", "Brand Origin Story", "How and why brand was created.", "story", 60,
    `Brand origin story. Founder story. The problem that started it all. The mission. Where we are now. Why it matters to you. CTA. Emotional, authentic.`),
  T("story-customer-journey", "Customer Journey", "Customer's full story arc.", "story", 60,
    `Customer journey story. 3-act arc. Act 1: Life before. Act 2: Discovery and transformation. Act 3: Life after. Product as hero. Emotional score. CTA.`),
  T("story-david-vs-goliath", "David vs Goliath", "Small brand challenging big industry.", "story", 60,
    `David vs Goliath story. 'We're not the biggest, but we're different'. What the big guys do wrong. How we do it differently. Community of believers. CTA.`),
  T("story-problem-discovery", "Problem Discovery", "How founder discovered the problem.", "story", 30,
    `Problem discovery story. Personal frustration that led to product. 'I couldn't find what I needed, so I built it'. Real founder energy. CTA.`),
  T("story-mission", "Mission Statement Ad", "Why the brand exists.", "story", 30,
    `Mission ad. Pure mission statement. Cinematic visuals. Voice-over about the 'why'. Who we serve. What we stand for. CTA feels like invitation.`),
  T("story-community", "Community Story", "The community around the brand.", "story", 60,
    `Community story. Show real users. Their diverse backgrounds. What connects them. Product as meeting point. 'You belong here'. CTA.`),
  T("story-behind-scenes", "Behind the Scenes", "How product is made.", "story", 60,
    `Behind the scenes. Factory or studio footage. Real people making the product. Care and craftsmanship shown. Quality proven. CTA.`),
  T("story-comeback", "The Comeback", "Brand or customer comeback story.", "story", 60,
    `Comeback story. Rock bottom moment. Decision to change. Hard work montage. Results. 'This is just the beginning'. Product as tool. CTA.`),
  T("app-onboarding", "App Onboarding Ad", "Show how easy it is to start.", "app", 30,
    `App onboarding ad. Screen recording. Download → open → first use. Each step under 10 seconds. 'Ready in 3 steps'. CTA to download. Trust-reducing friction.`),
  T("app-feature-showcase", "Feature Tour", "Key features in 30 seconds.", "app", 30,
    `App feature tour. Screen recording style. 5 features, 5 seconds each. Text callouts. Smooth transitions. CTA with app store rating.`),
  T("app-testimonial", "App Review Ad", "Read out 5-star review.", "app", 15,
    `App review ad. Screen shows app store page. 5 stars animation. Review read out. App shown in background. CTA to download.`),
  T("app-notification", "Notification Hook", "App notification as hook.", "app", 15,
    `Notification hook. Phone screen, notification appears. Viewer sees what the app notified them about. Curiosity. Open app. Result. CTA.`),
  T("app-vs-manual", "App vs Manual", "Show time saved vs doing it manually.", "app", 30,
    `App vs manual. Split screen. Left: manual painful process. Right: app doing it in seconds. Time saved shown. CTA. Efficiency-driven.`),
  T("app-screen-record", "Screen Recording Ad", "Real screen recording of app in use.", "app", 60,
    `Screen record ad. Real phone screen. Real fingers using app. Authentic, no production. Show full use case. Outcome. CTA overlay.`),
  T("app-challenge", "App Challenge", "7-day app challenge.", "app", 60,
    `App challenge. '7 days using this app changed my life'. Day 1-7 montage. Progressive results. Final outcome. CTA.`),
  T("app-update", "New Feature Launch", "Announce new app feature.", "app", 30,
    `New feature launch. 'We just dropped the update you've been asking for'. Feature reveal. Demo in seconds. Who needs it. CTA to update.`),
  T("b2b-roi", "ROI Calculator", "Show the financial return.", "b2b", 60,
    `B2B ROI ad. Scene 1: The cost of the problem (time wasted). Scene 2: Product solution. Scene 3: Time/money saved (specific numbers). Scene 4: ROI calculation. Scene 5: CTA. Data-driven, professional.`),
  T("b2b-case-study", "Case Study", "Real business result story.", "b2b", 60,
    `B2B case study. Company name (or type). Challenge. Solution implemented. Results (specific metrics). Quote. CTA. Trust-based.`),
  T("b2b-founder-pitch", "Founder Pitch", "CEO/founder talking to other CEOs.", "b2b", 60,
    `Founder pitch ad. CEO to CEO. Peer-to-peer tone. 'I built this because I was frustrated with...'. The insight. The solution. ROI. CTA.`),
  T("b2b-team-productivity", "Team Productivity", "How product improves entire team.", "b2b", 30,
    `Team productivity ad. Show team before: chaos. Show team after: aligned. What changed: the product. Feature that enables team use. CTA for team plan.`),
  T("b2b-integration", "Integration Showcase", "Show how it connects to existing tools.", "b2b", 30,
    `Integration ad. 'Works with everything you already use'. Show logos: Slack, Salesforce, etc. One-click setup. CTA. Low-friction B2B.`),
  T("b2b-security", "Security/Compliance", "Enterprise trust-builder.", "b2b", 30,
    `Security trust ad. SOC2, GDPR, compliance shown. What happens to their data. Who uses it (logos of known companies). CTA for enterprise plan.`),
  T("b2b-free-trial-b2b", "Team Free Trial", "No-risk team trial push.", "b2b", 30,
    `B2B free trial. 'Try it with your entire team, free for 14 days'. No credit card. Seats for whole team. What they'll experience. CTA.`),
  T("b2b-workflow", "Workflow Automation", "Show hours saved through automation.", "b2b", 60,
    `Workflow automation ad. 'You're wasting X hours per week on [task]'. Show the manual process. Show automated version. Hours saved per month. CTA.`),
  T("b2b-competitor-switch", "Switch From Competitor", "Migration-focused ad.", "b2b", 30,
    `Switch ad. 'Still using [competitor category]?'. What you're missing. Import in 1 click. Better results. Same price. CTA to migrate.`),
  T("b2b-social-proof", "Enterprise Logos", "Logo wall trust ad.", "b2b", 30,
    `Enterprise logos ad. Impressive logo wall (Fortune 500 style). '[X] companies trust us with [use case]'. Quick product flash. CTA for demo.`),
  T("seasonal-new-year", "New Year Resolution", "January motivation ad.", "seasonal", 30,
    `New Year ad. 'This is the year [goal]'. Resolution energy. Product as the tool to achieve it. 'No more excuses'. CTA. January-optimized.`),
  T("seasonal-valentine", "Valentine's Day", "Gift-focused love ad.", "seasonal", 15,
    `Valentine's Day. Romantic tone. 'For someone who means everything'. Product as perfect gift. Price + CTA. Emotional, fast.`),
  T("seasonal-summer", "Summer Vibes", "Summer lifestyle ad.", "seasonal", 30,
    `Summer ad. Energy, sun, outdoor vibes. Product in summer context. 'Your summer essential'. CTA. Seasonal relevance.`),
  T("seasonal-black-friday", "Black Friday", "Biggest sale of the year.", "seasonal", 15,
    `Black Friday. BIGGEST DEAL OF THE YEAR. Dramatic countdown. The offer. What's included. Urgency. CTA. Bold, aggressive.`),
  T("seasonal-back-to-school", "Back to School", "Student/parent seasonal hook.", "seasonal", 30,
    `Back to school. Parent or student preparing. Product as essential supply. Practical value. Price point. CTA. Real situation.`),
  T("seasonal-mothers-day", "Mother's Day", "Emotional gifting ad.", "seasonal", 30,
    `Mother's Day. Emotional footage. 'For the person who gave you everything'. Product as gift. Personalization angle. CTA.`),
  T("seasonal-world-cup", "World Cup / Sports Event", "Event-tied sports ad.", "seasonal", 30,
    `Sports event ad. Energy of the event. Fans, passion, community. Product as part of the experience. CTA. Moment marketing.`),
  T("seasonal-end-of-year", "Year in Review", "Reflection + forward-looking.", "seasonal", 30,
    `Year review ad. Nostalgic montage. What changed this year. Product as part of the journey. 'Here's to next year'. CTA.`),
  T("ecommerce-pdp", "Product Detail Page Style", "Mimics a product page.", "ecommerce", 30,
    `PDP-style ad. Clean product photography. Feature bullets shown. Reviews stars. Price. 'Add to cart' CTA. Looks like organic browse. E-commerce native.`),
  T("ecommerce-collection", "Collection Launch", "New product line.", "ecommerce", 30,
    `Collection launch. 'The [season] collection is here'. Multiple products shown. Color variants. Lifestyle shots. 'Shop now'. CTA.`),
  T("ecommerce-size-fit", "Size & Fit Guide", "Reduce return anxiety.", "ecommerce", 60,
    `Size/fit guide ad. 'Finding your perfect size is easy'. Size chart explanation. Real people different sizes modeling. 'Free returns'. CTA.`),
  T("ecommerce-styling", "Styling Tips", "3 ways to style/use product.", "ecommerce", 60,
    `Styling tips. '3 ways to style [product]'. Each look/use shown. Versatility as value. 'One product, infinite looks'. CTA.`),
  T("ecommerce-shipping", "Fast Shipping", "Delivery speed ad.", "ecommerce", 15,
    `Shipping ad. 'Order today, get it [day]'. Order process shown fast. Tracking. Package arrives. Smile. CTA. Speed as differentiator.`),
  T("ecommerce-return", "Easy Returns", "Trust-reducing returns policy.", "ecommerce", 30,
    `Returns trust ad. 'If you don't love it, returns are on us'. Show how easy return is. No-risk purchase. Why they stand by it. CTA.`),
  T("ecommerce-gifting", "Gift Guide", "Curated gift recommendations.", "ecommerce", 30,
    `Gift guide ad. '5 gifts they'll actually use'. Each shown quickly. Price range shown. Bundle option. 'Shop the guide'. CTA.`),
  T("ecommerce-review-aggregate", "1000 Reviews Can't Be Wrong", "Social proof volume ad.", "ecommerce", 30,
    `Review volume ad. '10,000 5-star reviews'. Show review snippets. Diversity of reviewers. 'Join them'. CTA. Trust through scale.`),
  T("ecommerce-sustainability", "Sustainable Product", "Eco-conscious positioning.", "ecommerce", 60,
    `Sustainability ad. Materials sourced responsibly. Manufacturing process. Impact numbers. Product as conscious choice. CTA.`),
  T("ecommerce-limited-edition", "Limited Edition Drop", "Scarcity collector's edition.", "ecommerce", 30,
    `Limited edition drop. 'Only 500 made'. Visual rarity. Collector's angle. What makes it special. 'Once it's gone, it's gone'. CTA.`),
  T("finance-save", "Save More", "Savings-focused financial product.", "finance", 30,
    `Savings ad. 'You're probably leaving [amount] on the table every month'. Show the gap. Product closes the gap. Simple math shown. CTA. Trust + clarity.`),
  T("finance-invest", "Start Investing", "Investment platform starter.", "finance", 60,
    `Investment starter ad. 'The best time to invest was yesterday. The second best is now.' Simple explanation. How to start in 3 steps. CTA.`),
  T("finance-debt", "Pay Off Debt", "Debt solution ad.", "finance", 60,
    `Debt solution. Real emotional story. The debt weight. Discovery of method/product. Progress shown. Freedom feeling. CTA.`),
  T("finance-budget", "Budgeting Made Easy", "Budgeting app/tool.", "finance", 30,
    `Budgeting ad. 'Most people have no idea where their money goes'. Show the reality. Product shows the picture. Control regained. CTA.`),
  T("finance-credit", "Build Your Credit", "Credit improvement product.", "finance", 60,
    `Credit builder ad. 'Bad credit doesn't have to be forever'. Score explained simply. How product helps. Timeline shown. CTA.`),
  T("finance-insurance", "Insurance Simplified", "Insurance product demystified.", "finance", 60,
    `Insurance ad. 'Insurance shouldn't be complicated'. Simple explanation. What's covered. What it costs. Signup in minutes. CTA.`),
  T("finance-transfer", "Send Money Fast", "Money transfer speed.", "finance", 15,
    `Money transfer ad. 'Send money in seconds'. Demo of app flow. International rates. No hidden fees. CTA. Speed + trust.`),
  T("finance-cashback", "Earn While You Spend", "Cashback reward ad.", "finance", 30,
    `Cashback ad. 'You're already spending money. You might as well earn while you do it'. How cashback works. Monthly earnings shown. CTA.`),
  T("finance-tax", "Tax Season", "Tax preparation product.", "finance", 30,
    `Tax season ad. 'It's that time of year'. Pain of taxes shown. Product simplifies it. Refund maximized. 'File in 30 minutes'. CTA.`),
  T("finance-crypto", "Crypto Simplified", "Cryptocurrency for beginners.", "finance", 60,
    `Crypto starter ad. 'Crypto doesn't have to be confusing'. Beginner's perspective. Simple start. Product guides. Risk explained. CTA.`),
  T("health-transformation", "Health Transformation", "Weight/health journey ad.", "health", 60,
    `Health transformation. Real journey. Starting point, struggles, discovery of product, progress, current state. Inspirational but realistic. CTA.`),
  T("health-doctor-recommended", "Doctor Backed", "Medical credibility ad.", "health", 60,
    `Doctor endorsed ad. Healthcare professional explains the science. Why they recommend this. Who it helps. Clinical backing shown. CTA.`),
  T("health-energy", "Beat Fatigue", "Energy supplement or solution.", "health", 30,
    `Energy ad. 'This is what 3pm usually looks like' (fatigue). 'This is 3pm now' (energy). Product shown. Mechanism briefly. CTA.`),
  T("health-sleep", "Better Sleep", "Sleep improvement product.", "health", 60,
    `Sleep ad. 'You're not just tired, you're sleep-deprived'. Real effects of bad sleep. Product science. Sleep data/tracking. Better tomorrow. CTA.`),
  T("health-workout", "Fitness Boost", "Workout performance product.", "health", 30,
    `Fitness ad. Gym or outdoor workout. Before: struggling. After: PR achieved. Product in the story. Community angle. CTA.`),
  T("health-mental", "Mental Wellness", "Mental health support product.", "health", 60,
    `Mental wellness ad. Sensitive, human tone. 'It's okay to not be okay'. Product as support tool. Not a cure — a help. Community. CTA.`),
  T("health-nutrition", "Clean Eating", "Nutrition product ad.", "health", 30,
    `Nutrition ad. 'You are what you eat'. Show what people typically eat. Show the alternative. Product as the upgrade. Taste + health. CTA.`),
  T("health-pain", "Pain Relief", "Pain management solution.", "health", 30,
    `Pain relief ad. Real pain being experienced. Limitation it causes. Product applied. Relief shown. Back to normal life. CTA.`),
  T("health-habit", "Daily Habit", "Build a health habit with product.", "health", 60,
    `Habit-building ad. '21 days to transform your health'. Day 1, 7, 14, 21 shown. Product as daily companion. Streak visual. CTA.`),
  T("health-immune", "Immune Support", "Immunity product.", "health", 30,
    `Immunity ad. 'Cold and flu season is coming'. Prevention vs cure. Product as defense. Science briefly. CTA.`),
  T("beauty-before-after", "Beauty Transformation", "Makeup/skincare before/after.", "beauty", 30,
    `Beauty transformation. Clean face to full look. Product used in process. Application technique shown. Final reveal. CTA.`),
  T("beauty-tutorial", "Beauty Tutorial", "Step-by-step beauty routine.", "beauty", 60,
    `Beauty tutorial ad. Full routine. 5 steps with product. Application tips. Close-up results. 'Your turn'. CTA.`),
  T("beauty-ingredient", "Hero Ingredient", "Key ingredient spotlight.", "beauty", 60,
    `Ingredient story. 'One ingredient changed my skin'. What it is. How it works. Results shown. Product features it. CTA.`),
  T("beauty-routine", "Morning Routine", "Daily skincare routine.", "beauty", 60,
    `Skincare routine ad. Morning ritual. Each product in sequence. Why each step matters. Glowing result. CTA.`),
  T("beauty-skin-type", "For Your Skin Type", "Personalized beauty approach.", "beauty", 30,
    `Skin type ad. 'Finally, made for [skin type] skin'. Show the specific problem. Product designed for it. Results on that skin type. CTA.`),
  T("beauty-comparison", "Before vs After Skin", "Skin improvement comparison.", "beauty", 30,
    `Skin comparison. Real skin, no filter. Before: problem area. After: improvement. Timeline shown. Product as cause. CTA.`),
  T("beauty-influencer-style", "Influencer Style", "Influencer-format beauty ad.", "beauty", 30,
    `Influencer beauty ad. Casual filming. 'My holy grail product'. Why they love it. Show application. 'Link in bio'. CTA.`),
  T("beauty-anti-aging", "Anti-Aging Science", "Age-defying product science.", "beauty", 60,
    `Anti-aging ad. Science of aging shown simply. How product addresses it. Clinical before/after. Age-appropriate casting. CTA.`),
  T("beauty-clean", "Clean Beauty", "Natural/clean ingredient positioning.", "beauty", 30,
    `Clean beauty ad. 'What's in your products?'. Show harmful ingredients commonly found. Product ingredient list revealed. Clean = better. CTA.`),
  T("beauty-affordable", "Luxury for Less", "Premium quality at accessible price.", "beauty", 30,
    `Luxury for less. 'Why pay $200 when this works just as well?'. Side-by-side comparison. Honest test. Price reveal. CTA.`),
  T("food-recipe", "Recipe Ad", "Food being prepared.", "food", 60,
    `Recipe ad. 'The easiest [dish] you'll ever make'. Ingredients shown. Step by step. Final dish reveal. 'Takes 15 minutes'. CTA.`),
  T("food-taste-test", "Taste Test", "Real reactions to food product.", "food", 30,
    `Taste test ad. Real people (strangers) trying product for first time. Genuine reactions. Ask them to rate. CTA. Social proof through taste.`),
  T("food-healthy-swap", "Healthy Swap", "Healthier alternative.", "food", 30,
    `Healthy swap. 'Swap [unhealthy thing] for this'. Show the unhealthy version. Introduce the swap. Taste comparison. 'Same satisfaction, better choice'. CTA.`),
  T("food-chef", "Chef Approved", "Professional chef endorsement.", "food", 30,
    `Chef approved. Professional chef uses product. 'I've used hundreds of ingredients, this is different'. Technical credibility. Home cook version. CTA.`),
  T("food-on-the-go", "On the Go Meal", "Convenience food ad.", "food", 15,
    `On-the-go food. Busy morning. Traditional breakfast vs product. 'Same nutrition, 60 seconds'. CTA. Speed + health.`),
  T("food-snack-attack", "Snack Attack", "Snack product craving ad.", "food", 15,
    `Snack ad. '3pm. You know the feeling.' Craving shown. Product appears. First bite reaction. Ingredients flash. CTA. Impulse trigger.`),
  T("food-meal-prep", "Meal Prep", "Weekly meal prep with product.", "food", 60,
    `Meal prep ad. Sunday prep session. Product central to process. 5 meals from one prep. Time saved. 'Eat well all week'. CTA.`),
  T("food-kids", "Kid Approved", "Parent/child food product.", "food", 30,
    `Kids food ad. Picky eater challenge. Product introduced. Kid tries it. Shocked approval. Parent relief. CTA. Emotional + practical.`),
  T("gaming-gameplay", "Gameplay Highlight", "Game clip with product overlay.", "gaming", 15,
    `Gameplay ad. Epic game moment. Product (peripheral/service) shown during key moment. Casual mention. 'This helped me do that'. CTA.`),
  T("gaming-setup", "Gaming Setup Tour", "Creator shows setup featuring product.", "gaming", 60,
    `Setup tour. Creator's gaming setup. Product featured prominently. Why it makes gaming better. Technical specs briefly. CTA.`),
  T("gaming-upgrade", "Performance Upgrade", "Before/after gaming performance.", "gaming", 30,
    `Gaming upgrade. 'My stats after using [product] for 30 days'. Before: mediocre. After: dominating. Product as the variable. CTA.`),
  T("gaming-community", "Gaming Community", "Tribe-based gaming ad.", "gaming", 30,
    `Gaming community ad. 'For the ones who take gaming seriously'. Community footage. Pro gamer angle. Product as membership badge. CTA.`),
  T("gaming-tournament", "Tournament Ready", "Competition preparation ad.", "gaming", 60,
    `Tournament prep. 'Tournament starts in 24 hours'. Mental prep, physical prep, gear check. Product as gear. 'Are you ready?'. CTA.`),
  T("gaming-parent", "For Parents", "Gaming product for concerned parents.", "gaming", 30,
    `Parent-targeted gaming. Parent perspective. Child's passion for gaming. Product that makes it safe/better/educational. Parent peace of mind. CTA.`),
  T("gaming-streamer", "Streamer Style", "Streaming-format gaming ad.", "gaming", 30,
    `Streamer ad. Live stream format. Streamer naturally mentions product. Chat reacts. 'Link in description'. CTA. Native to platform.`),
  T("gaming-nostalgia", "Retro Gaming Hook", "Nostalgia-driven gaming ad.", "gaming", 30,
    `Nostalgia gaming. 'Remember when gaming was simpler?'. Retro reference. But modern product for modern gaming. Best of both worlds. CTA.`),
  T("real-estate-listing", "Property Showcase", "Beautiful property listing ad.", "real_estate", 60,
    `Property listing ad. Cinematic tour. Key features highlighted. Neighborhood shown. Price reveal. Agent contact. CTA.`),
  T("real-estate-tips", "Home Buying Tips", "Educational real estate content.", "real_estate", 60,
    `Home buying tips ad. '5 mistakes first-time buyers make'. Each mistake with product/service solution. Expertise shown. CTA.`),
  T("real-estate-investment", "Investment Property", "Real estate investment angle.", "real_estate", 60,
    `Investment property ad. 'Your money shouldn't just sit in a bank'. Real estate return shown. Service/platform simplifies it. Numbers shown. CTA.`),
  T("real-estate-virtual-tour", "Virtual Tour", "360 virtual property tour.", "real_estate", 60,
    `Virtual tour ad. Full property walkthrough via phone/screen. Key features called out. 'Tour 10 properties from your couch'. CTA.`),
  T("real-estate-neighborhood", "Neighborhood Spotlight", "Location-based property ad.", "real_estate", 60,
    `Neighborhood ad. 'You don't just buy a home, you buy a neighborhood'. Show community. Schools, restaurants, parks. Property in context. CTA.`),
  T("real-estate-agent", "Agent Introduction", "Personal agent branding.", "real_estate", 60,
    `Agent intro ad. Personal story. Why they became an agent. Community knowledge. Track record. 'Let's find your home'. CTA.`),
  T("real-estate-rent-vs-buy", "Rent vs Buy Calculator", "Financial comparison ad.", "real_estate", 60,
    `Rent vs buy ad. Monthly rent vs mortgage comparison. 10-year projection. 'You could own this by now'. Product/service helps decide. CTA.`),
  T("real-estate-staging", "Home Staging", "Staging service ad.", "real_estate", 30,
    `Staging ad. Before: empty/cluttered home. After: staged beautifully. Price difference: staged homes sell for X% more. CTA.`),
  T("education-skill", "Learn a New Skill", "Skill acquisition ad.", "education", 60,
    `Skill learning ad. 'In 30 days you could [skill]'. Journey shown. Beginner to competent. Product as teacher. Career impact. CTA.`),
  T("education-certification", "Get Certified", "Professional certification ad.", "education", 60,
    `Certification ad. 'This certificate increased my salary by X%'. Industry demand shown. Course structure. Time investment. ROI. CTA.`),
  T("education-kids", "Kids Learning", "Children's educational product.", "education", 60,
    `Kids education ad. Parent's desire to help child succeed. Child engaging happily. Learning happening. Progress visible. Parent relief. CTA.`),
  T("education-language", "Learn a Language", "Language learning app.", "education", 60,
    `Language ad. 'I became fluent in 6 months'. Journey shown. App/method used. Social proof. 'Your turn'. CTA.`),
  T("education-online-course", "Online Course Launch", "Course creator promotion.", "education", 30,
    `Course launch ad. Instructor credibility established. Pain point addressed. What you'll learn. Transformation promised. Limited enrollment. CTA.`),
  T("education-tutoring", "Academic Support", "Tutoring service ad.", "education", 60,
    `Tutoring ad. Student struggling. Parent concern. Tutor found. Grade improvement shown. Confidence built. CTA.`),
  T("education-corporate", "Corporate Training", "B2B learning platform.", "education", 60,
    `Corporate training ad. 'Your team is your biggest asset'. Skills gap shown. Training solution. Employee satisfaction. ROI for company. CTA.`),
  T("education-micro", "Micro-Learning", "Short-burst learning.", "education", 30,
    `Micro-learning ad. '5 minutes a day. That's all it takes.' What you can learn. Daily habit shown. Month-end result. CTA.`),
  T("travel-destination", "Destination Ad", "Travel to dream location.", "travel", 60,
    `Destination ad. Cinematic travel footage. 'You deserve this'. Best moments. Practical travel info. Booking CTA. Aspirational.`),
  T("travel-deal", "Travel Deal", "Price-based travel promotion.", "travel", 30,
    `Travel deal. 'Flights to [destination] for $X'. Price shock. What's included. Dates. Book now or miss it. Urgent CTA.`),
  T("travel-travel-hack", "Travel Hacks", "Tips that make travel easier.", "travel", 60,
    `Travel hack ad. '5 travel hacks that changed how I travel'. Each hack shown. Product/service as enabler of hack. CTA.`),
  T("travel-solo", "Solo Travel", "Solo traveler empowerment.", "travel", 60,
    `Solo travel ad. 'Best decision I ever made'. Fear vs reality. Empowerment story. Safety + freedom. Product helps. CTA.`),
  T("travel-family", "Family Travel", "Family vacation ad.", "travel", 60,
    `Family travel ad. Family memories. Kids' reactions. Stress-free experience. Product makes it possible. 'Memories that last'. CTA.`),
  T("travel-luxury", "Luxury Travel", "Premium travel experience.", "travel", 60,
    `Luxury travel. Aspirational footage. Premium service. 'Because you've earned it'. Price positioned as investment. CTA.`),
  T("travel-budget", "Budget Travel", "Affordable travel tips.", "travel", 60,
    `Budget travel. 'I traveled Europe for $1500'. How they did it. Product/service that helped. Specific tips. CTA.`),
  T("travel-adventure", "Adventure Travel", "Extreme/adventure travel.", "travel", 60,
    `Adventure travel. Adrenaline footage. 'Life's too short for ordinary trips'. Product for adventurers. Safety + thrill. CTA.`),

  T("ig-welcome-bonus", "Welcome Bonus Reveal", "Big number hook revealing the welcome bonus.", "igaming", 15,
    `Scene 1 (0-3s): Big number on screen — bonus amount
Scene 2 (4-9s): How to claim — simple steps
Scene 3 (10-12s): Winning reaction clip
Scene 4 (13-15s): CTA — Register now
Tone: Exciting, urgent.`),

  T("ig-jackpot-winner", "Jackpot Winner Story", "Real winner story driving FOMO.", "igaming", 30,
    `Scene 1 (0-4s): Winner reaction — shock and joy
Scene 2 (5-12s): How much they won and when
Scene 3 (13-22s): What they did with the money
Scene 4 (23-27s): 'It could be you'
Scene 5 (28-30s): Register CTA
Tone: Aspirational, credible.`),

  T("ig-slot-gameplay", "Slot Gameplay Hook", "Exciting slot moment driving curiosity.", "igaming", 15,
    `Scene 1 (0-3s): Big win moment — sound + visuals
Scene 2 (4-9s): Game features showcase
Scene 3 (10-12s): Bonus round trigger
Scene 4 (13-15s): Play now CTA
Tone: High energy, FOMO-driven.`),

  T("ig-sports-bet", "Sports Bet Win", "Live bet win moment with commentary energy.", "igaming", 30,
    `Scene 1 (0-5s): Live match tension — last minute
Scene 2 (6-12s): Bet slip reveal
Scene 3 (13-22s): Win confirmation — cash out
Scene 4 (23-27s): Odds showcase for upcoming match
Scene 5 (28-30s): Place your bet CTA
Tone: Sports commentator energy.`),

  T("ig-cashback", "Cashback Offer", "Platform cashback offer with safety net angle.", "igaming", 15,
    `Scene 1 (0-3s): 'What if you could lose nothing?'
Scene 2 (4-9s): Cashback mechanic explained simply
Scene 3 (10-12s): Cashback credited in app
Scene 4 (13-15s): Claim now CTA
Tone: Reassuring, low-risk framing.`),

  T("ig-live-casino", "Live Casino Experience", "Real dealer experience showcase.", "igaming", 30,
    `Scene 1 (0-4s): Live dealer reveal — Vegas feeling
Scene 2 (5-12s): Real-time gameplay with live chat
Scene 3 (13-22s): Win moment at live table
Scene 4 (23-27s): Games available — roulette, baccarat, blackjack
Scene 5 (28-30s): Join live now CTA
Tone: Premium, exclusive.`),

  T("ig-fast-withdrawal", "Fast Withdrawal", "Speed of withdrawal as key differentiator.", "igaming", 15,
    `Scene 1 (0-3s): 'Withdrew at 9am, money by 10am'
Scene 2 (4-9s): App withdrawal flow — 3 steps
Scene 3 (10-12s): Bank notification visual
Scene 4 (13-15s): Try it yourself CTA
Tone: Direct, proof-based.`),

  T("ig-responsible", "Responsible Gaming", "Trust-building responsible gaming message.", "igaming", 30,
    `Scene 1 (0-5s): 'We want you to enjoy, not stress'
Scene 2 (6-15s): Deposit limit tools shown
Scene 3 (16-22s): Self-exclusion options
Scene 4 (23-27s): Support resources
Scene 5 (28-30s): Play your way CTA
Tone: Caring, trustworthy.`),

  T("ig-app-download", "App Download Push", "Mobile app download with exclusive bonus.", "igaming", 15,
    `Scene 1 (0-3s): Phone screen — app opening
Scene 2 (4-9s): Key app features swipe
Scene 3 (10-12s): Exclusive app bonus reveal
Scene 4 (13-15s): Download free CTA
Tone: Tech-forward, exclusive.`),

  T("ig-odds-comparison", "Odds Comparison", "Best odds in the market proof.", "igaming", 30,
    `Scene 1 (0-4s): 'Are you leaving money on the table?'
Scene 2 (5-14s): Odds comparison — our odds vs others
Scene 3 (15-22s): Same bet, bigger return demo
Scene 4 (23-27s): Odds boost promo
Scene 5 (28-30s): Switch now CTA
Tone: Analytical, proof-heavy.`),

  T("ig-vip-club", "VIP Club", "Exclusive VIP program benefits reveal.", "igaming", 60,
    `Scene 1 (0-8s): 'Not everyone gets invited'
Scene 2 (9-20s): VIP benefits — cashback, bonuses, dedicated manager
Scene 3 (21-35s): VIP member story
Scene 4 (36-50s): How to qualify — milestones
Scene 5 (51-57s): Apply now
Scene 6 (58-60s): VIP CTA
Tone: Exclusive, aspirational.`),

  T("ig-free-bet", "Free Bet Offer", "Risk-free bet offer to lower barrier.", "igaming", 15,
    `Scene 1 (0-3s): 'Your first bet is on us'
Scene 2 (4-9s): Free bet claim steps
Scene 3 (10-12s): Winning with free bet
Scene 4 (13-15s): Claim free bet CTA
Tone: Generous, risk-free framing.`),

  T("ig-tournament", "Tournament Entry", "Compete against others for prize pool.", "igaming", 30,
    `Scene 1 (0-5s): Leaderboard reveal — top players
Scene 2 (6-14s): Prize pool breakdown
Scene 3 (15-22s): How to enter
Scene 4 (23-27s): Current top player highlighted
Scene 5 (28-30s): Join tournament CTA
Tone: Competitive, exciting.`),

  T("ig-payment-methods", "Multiple Payment Methods", "Easy deposits with multiple options.", "igaming", 15,
    `Scene 1 (0-3s): 'Deposit your way'
Scene 2 (4-9s): Payment methods shown — Pix, card, crypto
Scene 3 (10-12s): Instant deposit confirmed
Scene 4 (13-15s): Deposit now CTA
Tone: Convenient, frictionless.`),

  T("ig-new-game", "New Game Launch", "New slot or game teaser.", "igaming", 15,
    `Scene 1 (0-3s): 'Brand new — dropping this week'
Scene 2 (4-9s): Game teaser footage
Scene 3 (10-12s): RTP and features highlight
Scene 4 (13-15s): Be first to play CTA
Tone: Exclusive, first-mover.`),

  T("ft-zero-fee", "Zero Fee Transfer", "No fees on transfers hook.", "fintech", 15,
    `Scene 1 (0-3s): 'Why are you still paying transfer fees?'
Scene 2 (4-9s): Fee comparison — bank vs us
Scene 3 (10-12s): Transfer completed — $0 fee
Scene 4 (13-15s): Send money free CTA
Tone: Challenger brand energy.`),

  T("ft-instant-credit", "Instant Credit Approval", "Speed of credit decision as differentiator.", "fintech", 30,
    `Scene 1 (0-4s): 'Approved in 60 seconds'
Scene 2 (5-12s): Application flow — phone screen
Scene 3 (13-22s): Approval notification
Scene 4 (23-27s): Money in account same day
Scene 5 (28-30s): Apply now CTA
Tone: Fast, reliable.`),

  T("ft-savings-goal", "Savings Goal Achievement", "Customer reaching savings goal story.", "fintech", 60,
    `Scene 1 (0-8s): 'I saved my emergency fund in 6 months'
Scene 2 (9-20s): Setting up the goal in app
Scene 3 (21-35s): Automatic savings working
Scene 4 (36-50s): Goal reached notification
Scene 5 (51-57s): What they did with savings
Scene 6 (58-60s): Start saving CTA
Tone: Empowering.`),

  T("ft-cashback-card", "Cashback Card", "Cashback on everyday purchases.", "fintech", 30,
    `Scene 1 (0-4s): 'I get paid to spend money'
Scene 2 (5-14s): Cashback categories shown
Scene 3 (15-22s): Monthly cashback earned
Scene 4 (23-27s): Cashback redemption
Scene 5 (28-30s): Get the card CTA
Tone: Smart spender.`),

  T("ft-investment-return", "Investment Returns", "Simple investing with real returns.", "fintech", 60,
    `Scene 1 (0-8s): 'My money grew while I slept'
Scene 2 (9-20s): Portfolio setup — 3 minutes
Scene 3 (21-35s): Return chart over time
Scene 4 (36-50s): Diversification explained simply
Scene 5 (51-57s): First investment moment
Scene 6 (58-60s): Start investing CTA
Tone: Accessible wealth.`),

  T("ft-expense-tracking", "Expense Tracking", "Automatic categorization saving money.", "fintech", 30,
    `Scene 1 (0-4s): 'I found I was wasting $300/mo'
Scene 2 (5-14s): Expense categories revealed automatically
Scene 3 (15-22s): Spending pattern insight
Scene 4 (23-27s): Action taken — cancelled subscriptions
Scene 5 (28-30s): Track your money CTA
Tone: Eye-opening.`),

  T("ft-business-account", "Business Account", "Business banking without the friction.", "fintech", 30,
    `Scene 1 (0-4s): 'I switched my business account in 10 minutes'
Scene 2 (5-14s): Business features — invoicing, payroll, cards
Scene 3 (15-22s): Dashboard overview
Scene 4 (23-27s): Time saved per month
Scene 5 (28-30s): Open business account CTA
Tone: Professional, efficient.`),

  T("ft-crypto-buy", "Crypto Made Simple", "Buy first crypto without the complexity.", "fintech", 15,
    `Scene 1 (0-3s): 'Buy Bitcoin in 2 minutes'
Scene 2 (4-9s): Purchase flow — simple and clean
Scene 3 (10-12s): Confirmation — you own crypto
Scene 4 (13-15s): Start with $10 CTA
Tone: Approachable, not intimidating.`),

  T("ft-debt-payoff", "Debt Payoff Plan", "Personalized debt payoff with app support.", "fintech", 60,
    `Scene 1 (0-8s): 'I paid off 40k in debt using this'
Scene 2 (9-22s): Debt payoff plan created automatically
Scene 3 (23-37s): Monthly progress tracking
Scene 4 (38-50s): Final debt cleared — emotional moment
Scene 5 (51-57s): Freedom after debt
Scene 6 (58-60s): Make a plan CTA
Tone: Motivational.`),

  T("ft-security", "Security Features", "Bank-grade security reassurance.", "fintech", 15,
    `Scene 1 (0-3s): 'Your money is safer here than in a bank'
Scene 2 (4-9s): Security features — biometric, 2FA, freeze card
Scene 3 (10-12s): Fraud alert stopped in real time
Scene 4 (13-15s): Open account securely CTA
Tone: Trustworthy, authoritative.`),

  T("ec-flash-sale", "Flash Sale Urgency", "Limited time sale with countdown.", "ecommerce", 15,
    `Scene 1 (0-3s): Countdown timer — hours remaining
Scene 2 (4-9s): Products on sale — rapid cuts
Scene 3 (10-12s): Price drop visual — before/after
Scene 4 (13-15s): Shop now before it ends CTA
Tone: Urgent, FOMO.`),

  T("ec-unboxing", "Unboxing Experience", "Premium unboxing moment driving desire.", "ecommerce", 30,
    `Scene 1 (0-4s): Package arrives — anticipation
Scene 2 (5-12s): Opening — premium packaging reveal
Scene 3 (13-20s): Product detail shots
Scene 4 (21-27s): First use impression
Scene 5 (28-30s): Order yours CTA
Tone: Aspirational.`),

  T("ec-free-shipping", "Free Shipping Push", "Remove shipping friction as barrier.", "ecommerce", 15,
    `Scene 1 (0-3s): 'Free shipping, no minimums, forever'
Scene 2 (4-9s): Checkout — $0 shipping line
Scene 3 (10-12s): Fast delivery confirmation
Scene 4 (13-15s): Shop now free shipping CTA
Tone: Direct, frictionless.`),

  T("ec-review-stack", "5-Star Review Stack", "Multiple glowing reviews building credibility.", "ecommerce", 30,
    `Scene 1 (0-4s): '4.9 stars from 12,000 reviews'
Scene 2 (5-10s): Review 1 — key quote
Scene 3 (11-16s): Review 2 — different use case
Scene 4 (17-22s): Review 3 — before/after
Scene 5 (23-27s): Review count visual
Scene 6 (28-30s): Join happy customers CTA
Tone: Social proof heavy.`),

  T("ec-bundle-deal", "Bundle & Save", "Bundle offer showing savings.", "ecommerce", 30,
    `Scene 1 (0-4s): 'Get 3, pay for 2'
Scene 2 (5-14s): Bundle contents shown
Scene 3 (15-22s): Price breakdown — savings highlighted
Scene 4 (23-27s): Bundle vs individual cost
Scene 5 (28-30s): Get the bundle CTA
Tone: Value-driven.`),

  T("ec-subscription", "Subscribe & Save", "Subscription model benefits.", "ecommerce", 30,
    `Scene 1 (0-4s): 'Never run out again'
Scene 2 (5-14s): Auto-delivery schedule shown
Scene 3 (15-22s): Savings vs one-time purchase
Scene 4 (23-27s): Cancel anytime reassurance
Scene 5 (28-30s): Subscribe now CTA
Tone: Convenient, reliable.`),

  T("ec-size-guide", "Perfect Fit Guarantee", "Remove sizing hesitation for apparel.", "ecommerce", 15,
    `Scene 1 (0-3s): 'Sick of wrong sizes? Us too'
Scene 2 (4-9s): Size guide tool — phone measurement
Scene 3 (10-12s): Perfect fit result
Scene 4 (13-15s): Shop with confidence CTA
Tone: Problem-solving.`),

  T("ec-gifting", "Gift Giving", "Product as the perfect gift.", "ecommerce", 30,
    `Scene 1 (0-4s): Gift receiving reaction — delight
Scene 2 (5-14s): Why it's the perfect gift — use cases
Scene 3 (15-22s): Gift wrapping option shown
Scene 4 (23-27s): Same-day/next-day delivery
Scene 5 (28-30s): Send a gift CTA
Tone: Warm, thoughtful.`),

  T("ec-influencer-collab", "Influencer Collab Drop", "Limited collab product launch.", "ecommerce", 15,
    `Scene 1 (0-3s): Collab reveal — two brand logos
Scene 2 (4-9s): Product showcase by influencer
Scene 3 (10-12s): 'Limited edition — selling fast'
Scene 4 (13-15s): Get it while it lasts CTA
Tone: Exclusive, hype.`),

  T("ec-return-policy", "Hassle-Free Returns", "Remove purchase risk with return policy.", "ecommerce", 15,
    `Scene 1 (0-3s): 'Don't love it? Return it. No questions'
Scene 2 (4-9s): Return process — 3 steps, 2 minutes
Scene 3 (10-12s): Full refund confirmed
Scene 4 (13-15s): Shop risk-free CTA
Tone: Reassuring.`),

  T("saas-demo", "Live Product Demo", "Showing core value in real-time.", "saas", 60,
    `Scene 1 (0-8s): Problem setup — 'This used to take me 2 hours'
Scene 2 (9-25s): Product demo — core workflow
Scene 3 (26-40s): Result achieved in minutes
Scene 4 (41-55s): Key features callout
Scene 5 (56-60s): Start free trial CTA
Tone: Show don't tell.`),

  T("saas-time-saved", "Time Saved ROI", "Hours saved per week proof.", "saas", 30,
    `Scene 1 (0-4s): 'I saved 8 hours last week'
Scene 2 (5-14s): Time-consuming process shown
Scene 3 (15-22s): Same task with product — minutes
Scene 4 (23-27s): Hours saved per month calculation
Scene 5 (28-30s): Start saving time CTA
Tone: Analytical.`),

  T("saas-team-collab", "Team Collaboration", "Team working better together.", "saas", 30,
    `Scene 1 (0-4s): 'My team went from chaotic to aligned'
Scene 2 (5-14s): Before — messy Slack threads
Scene 3 (15-22s): After — organized workspace
Scene 4 (23-27s): Team productivity metric
Scene 5 (28-30s): Try with your team CTA
Tone: Aspirational team culture.`),

  T("saas-migration", "Easy Migration", "Switching from competitor made painless.", "saas", 30,
    `Scene 1 (0-4s): 'Switched from [competitor] in one afternoon'
Scene 2 (5-14s): Migration wizard — simple and fast
Scene 3 (15-22s): Data imported — ready to go
Scene 4 (23-27s): Support team available
Scene 5 (28-30s): Switch today CTA
Tone: Confident, reassuring.`),

  T("saas-free-trial", "Free Trial Barrier Removal", "No credit card — try free.", "saas", 15,
    `Scene 1 (0-3s): 'No credit card. No commitment.'
Scene 2 (4-9s): Signup in 30 seconds shown
Scene 3 (10-12s): Full features unlocked immediately
Scene 4 (13-15s): Start free CTA
Tone: Low friction.`),

  T("saas-integration", "Integrations Ecosystem", "Connects with tools you already use.", "saas", 30,
    `Scene 1 (0-4s): 'Works with everything you already use'
Scene 2 (5-14s): Integration logos — Slack, Notion, Google, etc.
Scene 3 (15-22s): Two-way sync demo
Scene 4 (23-27s): Setup in 1 click shown
Scene 5 (28-30s): Connect your stack CTA
Tone: Seamless.`),

  T("saas-security", "Enterprise Security", "SOC2, GDPR, data protection proof.", "saas", 30,
    `Scene 1 (0-4s): 'Your data is our responsibility'
Scene 2 (5-14s): Security certifications shown
Scene 3 (15-22s): Encryption and access controls
Scene 4 (23-27s): Enterprise client logos
Scene 5 (28-30s): Book security review CTA
Tone: Enterprise trust.`),

  T("saas-customer-success", "Customer Success Story", "Customer achieving measurable ROI.", "saas", 60,
    `Scene 1 (0-8s): Customer challenge setup
Scene 2 (9-22s): Implementation story
Scene 3 (23-40s): Results — specific metrics
Scene 4 (41-55s): What changed for the team
Scene 5 (56-60s): Read full case study CTA
Tone: Credibility-driven.`),

  T("saas-pricing", "Transparent Pricing", "Clear pricing with value comparison.", "saas", 30,
    `Scene 1 (0-4s): 'You shouldn't have to guess what you'll pay'
Scene 2 (5-14s): Pricing tiers shown clearly
Scene 3 (15-22s): What's included — feature comparison
Scene 4 (23-27s): ROI calculation
Scene 5 (28-30s): See pricing CTA
Tone: Honest, transparent.`),

  T("saas-ai-feature", "AI Feature Showcase", "AI-powered feature driving productivity.", "saas", 30,
    `Scene 1 (0-4s): 'Our AI just replaced 3 manual steps'
Scene 2 (5-14s): AI feature in action
Scene 3 (15-22s): Output quality shown
Scene 4 (23-27s): Time saved by AI
Scene 5 (28-30s): Try AI features free CTA
Tone: Forward-looking.`),

  T("hlt-weight-loss", "Weight Loss Journey", "Real transformation over time.", "health", 60,
    `Scene 1 (0-8s): '3 months ago I almost gave up'
Scene 2 (9-22s): The struggle — before state
Scene 3 (23-38s): Discovery and first results
Scene 4 (39-52s): Transformation — after state
Scene 5 (53-58s): How they did it
Scene 6 (59-60s): Start your journey CTA
Tone: Vulnerable and inspiring.`),

  T("hlt-supplement", "Supplement Benefits", "Ingredient science made simple.", "health", 30,
    `Scene 1 (0-4s): 'The ingredient doctors actually recommend'
Scene 2 (5-14s): How the ingredient works — simple animation
Scene 3 (15-22s): Clinical study result referenced
Scene 4 (23-27s): Before/after energy levels
Scene 5 (28-30s): Try risk-free CTA
Tone: Science-backed.`),

  T("hlt-mental-health", "Mental Health Support", "Stress and anxiety reduction proof.", "health", 60,
    `Scene 1 (0-8s): 'I haven't felt this calm in years'
Scene 2 (9-22s): Daily anxiety struggle
Scene 3 (23-38s): Solution introduced — app/supplement
Scene 4 (39-52s): Daily practice results
Scene 5 (53-58s): Life quality improvement
Scene 6 (59-60s): Start feeling better CTA
Tone: Compassionate.`),

  T("hlt-sleep", "Sleep Quality", "Better sleep life change story.", "health", 30,
    `Scene 1 (0-4s): 'I finally slept 8 hours for the first time in years'
Scene 2 (5-14s): Sleep tracker data shown
Scene 3 (15-22s): What changed
Scene 4 (23-27s): Next-day energy difference
Scene 5 (28-30s): Fix your sleep CTA
Tone: Relatable struggle.`),

  T("hlt-immunity", "Immunity Boost", "Cold and flu season protection.", "health", 15,
    `Scene 1 (0-3s): 'Cold and flu season survival pack'
Scene 2 (4-9s): Key ingredients — what they do
Scene 3 (10-12s): 'Zero sick days this winter'
Scene 4 (13-15s): Stock up now CTA
Tone: Preventive.`),

  T("hlt-energy", "Energy Without Caffeine", "Clean energy alternative.", "health", 30,
    `Scene 1 (0-4s): '3pm crash? Never again'
Scene 2 (5-14s): Caffeine crash problem
Scene 3 (15-22s): Clean energy solution
Scene 4 (23-27s): Energy sustained all day
Scene 5 (28-30s): Try it today CTA
Tone: Relatable problem.`),

  T("hlt-telehealth", "Telehealth Convenience", "Doctor on demand value prop.", "health", 30,
    `Scene 1 (0-4s): 'Saw a doctor in 8 minutes — from my couch'
Scene 2 (5-14s): App booking flow
Scene 3 (15-22s): Video call with doctor
Scene 4 (23-27s): Prescription delivered
Scene 5 (28-30s): See a doctor now CTA
Tone: Convenient, modern.`),

  T("hlt-meditation", "Meditation App", "Daily meditation habit transformation.", "health", 60,
    `Scene 1 (0-8s): '5 minutes a day changed everything'
Scene 2 (9-22s): Anxiety before meditation habit
Scene 3 (23-38s): First week — guided sessions
Scene 4 (39-52s): One month in — measurable change
Scene 5 (53-58s): Current practice
Scene 6 (59-60s): Start free CTA
Tone: Peaceful.`),

  T("bty-skincare-routine", "Skincare Routine", "Morning/night routine featuring product.", "beauty", 60,
    `Scene 1 (0-8s): Glowing skin reveal — no filter
Scene 2 (9-22s): Morning routine — each step
Scene 3 (23-38s): Product hero moment — application
Scene 4 (39-52s): 30-day skin comparison
Scene 5 (53-58s): 'This is the one step I'll never skip'
Scene 6 (59-60s): Shop now CTA
Tone: Aspirational beauty.`),

  T("bty-ingredient", "Hero Ingredient", "Key ingredient science and results.", "beauty", 30,
    `Scene 1 (0-4s): 'This one ingredient changed my skin'
Scene 2 (5-14s): What the ingredient does — simple
Scene 3 (15-22s): Before/after skin texture
Scene 4 (23-27s): Application technique
Scene 5 (28-30s): Try it CTA
Tone: Knowledgeable friend.`),

  T("bty-shade-match", "Shade Match AI", "Perfect shade finding technology.", "beauty", 15,
    `Scene 1 (0-3s): 'Finally found my perfect match'
Scene 2 (4-9s): Shade finder tool in action
Scene 3 (10-12s): Perfect foundation match
Scene 4 (13-15s): Shop your shade CTA
Tone: Inclusive.`),

  T("bty-makeup-tutorial", "Makeup Tutorial", "Step-by-step look using product.", "beauty", 60,
    `Scene 1 (0-8s): Final look reveal
Scene 2 (9-22s): Base — product by product
Scene 3 (23-38s): Eye look — detailed
Scene 4 (39-52s): Lips and finishing
Scene 5 (53-58s): Products used list
Scene 6 (59-60s): Shop the look CTA
Tone: Educational, inspiring.`),

  T("bty-clean-beauty", "Clean Beauty", "Toxin-free formula reassurance.", "beauty", 30,
    `Scene 1 (0-4s): 'I read every ingredient label now'
Scene 2 (5-14s): Toxic ingredients in other brands
Scene 3 (15-22s): Our clean formula shown
Scene 4 (23-27s): Third-party certifications
Scene 5 (28-30s): Shop clean beauty CTA
Tone: Conscious consumer.`),

  T("bty-anti-aging", "Anti-Aging Results", "Visible results on real skin.", "beauty", 60,
    `Scene 1 (0-8s): 'People think I'm 10 years younger'
Scene 2 (9-22s): Skin before — fine lines, texture
Scene 3 (23-38s): 90-day treatment journey
Scene 4 (39-52s): After — visible difference
Scene 5 (53-58s): Dermatologist comment
Scene 6 (59-60s): Start your treatment CTA
Tone: Scientific and aspirational.`),

  T("bty-mens-grooming", "Men's Grooming", "Grooming routine for men.", "beauty", 30,
    `Scene 1 (0-4s): 'The only grooming routine you'll ever need'
Scene 2 (5-14s): 3-step routine shown
Scene 3 (15-22s): Before/after results
Scene 4 (23-27s): Simple packaging and use
Scene 5 (28-30s): Get the kit CTA
Tone: Masculine, no-nonsense.`),

  T("fit-transformation", "Body Transformation", "Physical transformation story.", "fitness", 60,
    `Scene 1 (0-8s): Current physique — confident reveal
Scene 2 (9-22s): Where they started
Scene 3 (23-38s): Training consistency shown
Scene 4 (39-52s): Progress milestones
Scene 5 (53-58s): How the product/program helped
Scene 6 (59-60s): Start your transformation CTA
Tone: Authentic, motivational.`),

  T("fit-workout-app", "Workout App Demo", "Home workout convenience.", "fitness", 30,
    `Scene 1 (0-4s): 'No gym? No problem.'
Scene 2 (5-14s): App workout selection
Scene 3 (15-22s): At-home workout in action
Scene 4 (23-27s): Progress tracking shown
Scene 5 (28-30s): Start free trial CTA
Tone: Empowering.`),

  T("fit-protein", "Protein Supplement", "Performance nutrition science.", "fitness", 30,
    `Scene 1 (0-4s): 'The cleanest protein on the market'
Scene 2 (5-14s): Ingredient list — clean label
Scene 3 (15-22s): Mixing and taste test
Scene 4 (23-27s): Recovery and muscle result
Scene 5 (28-30s): Get yours CTA
Tone: Athlete-focused.`),

  T("fit-personal-trainer", "Virtual Personal Trainer", "Personalized coaching without the price.", "fitness", 60,
    `Scene 1 (0-8s): 'I finally have a personal trainer — for $30/mo'
Scene 2 (9-22s): Personalized program creation
Scene 3 (23-38s): First workout session
Scene 4 (39-52s): Trainer feedback and adjustments
Scene 5 (53-58s): One month results
Scene 6 (59-60s): Get your trainer CTA
Tone: Accessible luxury.`),

  T("fit-wearable", "Fitness Wearable", "Health tracking data motivation.", "fitness", 30,
    `Scene 1 (0-4s): 'I had no idea my body was doing this'
Scene 2 (5-14s): Data reveal — heart rate, sleep, steps
Scene 3 (15-22s): Insight that changed behavior
Scene 4 (23-27s): Health improvement over 30 days
Scene 5 (28-30s): Track your health CTA
Tone: Data-driven.`),

  T("food-recipe", "Recipe Integration", "Product used in aspirational recipe.", "food", 30,
    `Scene 1 (0-4s): Final dish reveal — mouth-watering
Scene 2 (5-14s): Key ingredient hero moment
Scene 3 (15-22s): Quick recipe steps
Scene 4 (23-27s): Taste reaction
Scene 5 (28-30s): Try the recipe CTA
Tone: Culinary aspirational.`),

  T("food-delivery", "Delivery Speed", "Fast delivery key differentiator.", "food", 15,
    `Scene 1 (0-3s): 'Ordered at 7:02, eating at 7:31'
Scene 2 (4-9s): Order to doorstep timeline
Scene 3 (10-12s): Fresh food unboxing
Scene 4 (13-15s): Order now CTA
Tone: Speed and freshness.`),

  T("food-subscription", "Meal Kit Subscription", "Meal prep convenience and health.", "food", 60,
    `Scene 1 (0-8s): 'I stopped eating out and started cooking'
Scene 2 (9-22s): Box delivery — fresh ingredients
Scene 3 (23-38s): Cooking in 20 minutes
Scene 4 (39-52s): Family meal moment
Scene 5 (53-58s): Weekly meal variety
Scene 6 (59-60s): Get first box free CTA
Tone: Family warmth.`),

  T("food-healthy-option", "Healthy Alternative", "Guilt-free indulgence angle.", "food", 30,
    `Scene 1 (0-4s): 'All the taste, none of the guilt'
Scene 2 (5-14s): Ingredient comparison — less sugar, more protein
Scene 3 (15-22s): Taste test reaction
Scene 4 (23-27s): Nutrition facts highlight
Scene 5 (28-30s): Try it CTA
Tone: Health-conscious indulgence.`),

  T("food-viral-taste", "Viral Taste Challenge", "Taste reaction format driving curiosity.", "food", 15,
    `Scene 1 (0-3s): 'Everyone told me to try this...'
Scene 2 (4-9s): First bite reaction — genuine
Scene 3 (10-12s): 'Now I understand the hype'
Scene 4 (13-15s): Get yours CTA
Tone: Social proof-driven curiosity.`),

  T("food-premium", "Premium Positioning", "Artisan/premium quality story.", "food", 30,
    `Scene 1 (0-4s): Origin story — farm/source
Scene 2 (5-14s): Craft process shown
Scene 3 (15-22s): Quality difference vs mass market
Scene 4 (23-27s): Chef or expert endorsement
Scene 5 (28-30s): Order premium CTA
Tone: Artisan quality.`),

  T("trv-destination", "Destination Showcase", "Dream destination FOMO.", "travel", 30,
    `Scene 1 (0-4s): Stunning location reveal
Scene 2 (5-14s): 3 unique experiences shown
Scene 3 (15-22s): Price reveal — more affordable than expected
Scene 4 (23-27s): Limited availability nudge
Scene 5 (28-30s): Book now CTA
Tone: Wanderlust.`),

  T("trv-deal", "Travel Deal Alert", "Price drop urgency.", "travel", 15,
    `Scene 1 (0-3s): 'This deal expires tonight'
Scene 2 (4-9s): Destination + price shown
Scene 3 (10-12s): What's included
Scene 4 (13-15s): Book before it's gone CTA
Tone: Urgent scarcity.`),

  T("trv-experience", "Experience Travel", "Unique experience over commodity.", "travel", 60,
    `Scene 1 (0-8s): 'I stopped going to touristy places'
Scene 2 (9-22s): Off-the-beaten-path experience
Scene 3 (23-38s): Local connections made
Scene 4 (39-52s): Memory created
Scene 5 (53-58s): How they found it
Scene 6 (59-60s): Find your experience CTA
Tone: Authentic travel.`),

  T("trv-business", "Business Travel", "Corporate travel efficiency.", "travel", 30,
    `Scene 1 (0-4s): 'Business travel that doesn't drain you'
Scene 2 (5-14s): Airport lounge, flat bed, priority boarding
Scene 3 (15-22s): In-flight productivity
Scene 4 (23-27s): Corporate account benefits
Scene 5 (28-30s): Upgrade your travel CTA
Tone: Professional luxury.`),

  T("trv-group", "Group Travel", "Group booking made simple.", "travel", 30,
    `Scene 1 (0-4s): 'Planning a group trip used to give me anxiety'
Scene 2 (5-14s): Group booking dashboard
Scene 3 (15-22s): Split payment and coordination
Scene 4 (23-27s): Group on the trip — happy
Scene 5 (28-30s): Plan your group trip CTA
Tone: Social and fun.`),

  T("fsh-outfit-inspo", "Outfit Inspiration", "Styling tips with product.", "fashion", 30,
    `Scene 1 (0-4s): Final outfit reveal
Scene 2 (5-14s): How to style 3 ways
Scene 3 (15-22s): Close-ups — fabric, detail
Scene 4 (23-27s): 'Shop the look' link
Scene 5 (28-30s): Get the look CTA
Tone: Style-forward.`),

  T("fsh-sustainable", "Sustainable Fashion", "Ethical and sustainable positioning.", "fashion", 60,
    `Scene 1 (0-8s): 'Fashion's dirty secret — I used to ignore it'
Scene 2 (9-22s): Industry impact
Scene 3 (23-38s): Our materials and process
Scene 4 (39-52s): Product quality and durability
Scene 5 (53-58s): Customer wearing for years
Scene 6 (59-60s): Shop with purpose CTA
Tone: Conscious brand.`),

  T("fsh-size-inclusive", "Size Inclusive", "All bodies can wear this.", "fashion", 30,
    `Scene 1 (0-4s): Diverse body types in same outfit
Scene 2 (5-14s): Different sizes shown equally beautifully
Scene 3 (15-22s): Customer fit confidence
Scene 4 (23-27s): Size range highlight
Scene 5 (28-30s): Find your size CTA
Tone: Empowering.`),

  T("fsh-capsule", "Capsule Wardrobe", "Minimalist wardrobe building.", "fashion", 60,
    `Scene 1 (0-8s): '10 pieces, 30 outfits'
Scene 2 (9-22s): Versatile piece styling options
Scene 3 (23-38s): Getting dressed made easy
Scene 4 (39-52s): Decluttering story
Scene 5 (53-58s): Key capsule pieces shown
Scene 6 (59-60s): Build yours CTA
Tone: Minimal lifestyle.`),

  T("fsh-season-drop", "New Season Drop", "New collection launch hype.", "fashion", 15,
    `Scene 1 (0-3s): 'New drop just landed'
Scene 2 (4-9s): Collection highlight reel
Scene 3 (10-12s): Limited pieces available
Scene 4 (13-15s): Shop the drop CTA
Tone: Hype.`),

  T("edu-career-change", "Career Change Success", "New skill leading to better job.", "education", 60,
    `Scene 1 (0-8s): 'I changed careers at 34 with zero experience'
Scene 2 (9-22s): The struggle — wrong career
Scene 3 (23-38s): Course and learning journey
Scene 4 (39-52s): Job offer received
Scene 5 (53-58s): New career and salary
Scene 6 (59-60s): Start your course CTA
Tone: Inspiring.`),

  T("edu-skill-demo", "Skill Demo", "Before/after skill showing course value.", "education", 30,
    `Scene 1 (0-4s): Student result showcase
Scene 2 (5-14s): What they could do before
Scene 3 (15-22s): What they can do after
Scene 4 (23-27s): Time it took
Scene 5 (28-30s): Enroll now CTA
Tone: Proof-based.`),

  T("edu-certification", "Certification Value", "Credential leading to opportunity.", "education", 30,
    `Scene 1 (0-4s): 'This certification got me 3 job offers'
Scene 2 (5-14s): Certification shown — credibility
Scene 3 (15-22s): Companies that recognize it
Scene 4 (23-27s): Salary increase after
Scene 5 (28-30s): Get certified CTA
Tone: ROI-focused.`),

  T("edu-free-lesson", "Free Lesson Teaser", "Sample class driving full enrollment.", "education", 30,
    `Scene 1 (0-4s): 'Watch our most popular lesson — free'
Scene 2 (5-14s): Key insight from lesson
Scene 3 (15-22s): Student reaction
Scene 4 (23-27s): What you get with full course
Scene 5 (28-30s): Watch free lesson CTA
Tone: Generous teacher.`),

  T("edu-community", "Learning Community", "Peer learning and accountability.", "education", 30,
    `Scene 1 (0-4s): 'The community is the real product'
Scene 2 (5-14s): Community in action — live sessions
Scene 3 (15-22s): Peer accountability story
Scene 4 (23-27s): Job referral from community
Scene 5 (28-30s): Join the community CTA
Tone: Belonging.`),

  T("re-first-buyer", "First-Time Buyer", "Home buying made accessible.", "real_estate", 60,
    `Scene 1 (0-8s): 'I bought my first home at 28 — here's how'
Scene 2 (9-22s): The fear — too expensive, too complicated
Scene 3 (23-38s): First conversation with agent
Scene 4 (39-52s): Offer accepted moment
Scene 5 (53-58s): Keys received
Scene 6 (59-60s): Talk to an agent CTA
Tone: Accessible and warm.`),

  T("re-investment", "Investment Property", "ROI of rental property investment.", "real_estate", 60,
    `Scene 1 (0-8s): 'My first property pays my mortgage'
Scene 2 (9-22s): Rental income math
Scene 3 (23-38s): Property selection process
Scene 4 (39-52s): Tenant found — cash flow starts
Scene 5 (53-58s): Portfolio growth plan
Scene 6 (59-60s): Find investment properties CTA
Tone: Wealth-building.`),

  T("re-luxury", "Luxury Listing", "Premium property showcase.", "real_estate", 30,
    `Scene 1 (0-4s): Drone shot — stunning property exterior
Scene 2 (5-14s): Interior walkthrough — key rooms
Scene 3 (15-22s): Amenities — pool, views, finishes
Scene 4 (23-27s): Neighborhood features
Scene 5 (28-30s): Schedule viewing CTA
Tone: Premium aspiration.`),

  T("re-market", "Market Report", "Local market intelligence positioning.", "real_estate", 30,
    `Scene 1 (0-4s): 'Is now a good time to buy?'
Scene 2 (5-14s): Local market data visual
Scene 3 (15-22s): Price trend insight
Scene 4 (23-27s): Agent expertise established
Scene 5 (28-30s): Get free market report CTA
Tone: Expert authority.`),

  T("re-virtual-tour", "Virtual Tour", "Remote property viewing technology.", "real_estate", 30,
    `Scene 1 (0-4s): 'Toured 12 homes without leaving the couch'
Scene 2 (5-14s): 360° virtual tour in action
Scene 3 (15-22s): Narrowed to 2 favorites — then visited
Scene 4 (23-27s): Time saved
Scene 5 (28-30s): Start virtual tour CTA
Tone: Efficient buyer.`),

  T("auto-ev", "EV Range Anxiety Killer", "Range and charging network reassurance.", "automotive", 30,
    `Scene 1 (0-4s): 'I used to be terrified of running out of charge'
Scene 2 (5-14s): Range shown — real drive
Scene 3 (15-22s): Charging network map
Scene 4 (23-27s): Cost vs gas comparison
Scene 5 (28-30s): Test drive CTA
Tone: Converting skeptics.`),

  T("auto-test-drive", "Test Drive Offer", "Removing barrier to first interaction.", "automotive", 15,
    `Scene 1 (0-3s): 'The car sells itself — just drive it'
Scene 2 (4-9s): Test drive experience
Scene 3 (10-12s): Customer reaction after drive
Scene 4 (13-15s): Book test drive CTA
Tone: Confident.`),

  T("auto-finance", "Easy Financing", "Affordable monthly payments.", "automotive", 30,
    `Scene 1 (0-4s): 'Your dream car for less than you think'
Scene 2 (5-14s): Monthly payment calculation
Scene 3 (15-22s): Approval in minutes
Scene 4 (23-27s): Drive off same day
Scene 5 (28-30s): Check your rate CTA
Tone: Accessible aspiration.`),

  T("auto-service", "Service Plan", "Car maintenance subscription.", "automotive", 30,
    `Scene 1 (0-4s): 'I never worry about car maintenance anymore'
Scene 2 (5-14s): What's included — oil, tires, brakes
Scene 3 (15-22s): Cost vs pay-as-you-go
Scene 4 (23-27s): Booking made easy — app
Scene 5 (28-30s): Get covered CTA
Tone: Peace of mind.`),

  T("cr-defi-yield", "DeFi Yield", "Passive income from crypto explained.", "crypto", 30,
    `Scene 1 (0-4s): 'My crypto earns while I sleep'
Scene 2 (5-14s): Staking/yield mechanics simple
Scene 3 (15-22s): APY shown clearly
Scene 4 (23-27s): Earnings dashboard
Scene 5 (28-30s): Start earning CTA
Tone: Financial freedom.`),

  T("cr-nft-utility", "NFT Utility", "Real-world utility of NFT.", "crypto", 30,
    `Scene 1 (0-4s): 'This JPG pays for my flights'
Scene 2 (5-14s): NFT benefits — access, rewards
Scene 3 (15-22s): Community value shown
Scene 4 (23-27s): Floor price growth
Scene 5 (28-30s): Join the collection CTA
Tone: Community-led.`),

  T("cr-wallet", "Crypto Wallet Security", "Non-custodial wallet safety.", "crypto", 30,
    `Scene 1 (0-4s): 'Your keys, your crypto'
Scene 2 (5-14s): Exchange hacks — scary stats
Scene 3 (15-22s): Self-custody setup — simple
Scene 4 (23-27s): Peace of mind
Scene 5 (28-30s): Secure your crypto CTA
Tone: Sovereignty.`),

  T("cr-beginners", "Crypto for Beginners", "First crypto purchase education.", "crypto", 60,
    `Scene 1 (0-8s): 'I wish someone had explained this to me 3 years ago'
Scene 2 (9-22s): What is blockchain — 60-second explainer
Scene 3 (23-38s): First purchase walkthrough
Scene 4 (39-52s): Portfolio diversification basics
Scene 5 (53-58s): Resources for learning more
Scene 6 (59-60s): Start with $50 CTA
Tone: Patient teacher.`),

  T("gm-new-release", "New Game Release", "Launch day hype.", "gaming", 15,
    `Scene 1 (0-3s): Launch trailer moment — explosive
Scene 2 (4-9s): Gameplay footage — best moments
Scene 3 (10-12s): 'Available now'
Scene 4 (13-15s): Buy/download now CTA
Tone: Hype, adrenaline.`),

  T("gm-esports", "Esports Tournament", "Competitive gaming excitement.", "gaming", 30,
    `Scene 1 (0-4s): Championship moment — crowd reaction
Scene 2 (5-14s): Tournament bracket and prize pool
Scene 3 (15-22s): How to qualify
Scene 4 (23-27s): Previous winners
Scene 5 (28-30s): Enter tournament CTA
Tone: Competitive.`),

  T("gm-gaming-gear", "Gaming Gear", "Performance hardware for serious gamers.", "gaming", 30,
    `Scene 1 (0-4s): 'My KD ratio doubled after switching gear'
Scene 2 (5-14s): Performance specs shown
Scene 3 (15-22s): Pro gamer endorsement
Scene 4 (23-27s): Setup showcase
Scene 5 (28-30s): Upgrade your setup CTA
Tone: Competitive gamer.`),

  T("gm-subscription", "Game Pass Value", "Gaming subscription ROI.", "gaming", 30,
    `Scene 1 (0-4s): '200+ games, one price'
Scene 2 (5-14s): Game library shown — variety
Scene 3 (15-22s): New games added monthly
Scene 4 (23-27s): Cost per game calculation
Scene 5 (28-30s): Start free trial CTA
Tone: Value math.`),

  T("ins-life", "Life Insurance Simplicity", "Term life made simple.", "insurance", 30,
    `Scene 1 (0-4s): 'I insured my family in 10 minutes'
Scene 2 (5-14s): Quote process — simple and fast
Scene 3 (15-22s): Coverage explained in plain English
Scene 4 (23-27s): Monthly premium revealed — affordable
Scene 5 (28-30s): Get your quote CTA
Tone: Protection and simplicity.`),

  T("ins-health", "Health Insurance", "Healthcare access reassurance.", "insurance", 30,
    `Scene 1 (0-4s): 'The ER bill that almost broke us'
Scene 2 (5-14s): Coverage protection story
Scene 3 (15-22s): Finding the right plan
Scene 4 (23-27s): Peace of mind with coverage
Scene 5 (28-30s): Find your plan CTA
Tone: Security.`),

  T("ins-pet", "Pet Insurance", "Vet bill protection.", "insurance", 15,
    `Scene 1 (0-3s): '$8,000 vet bill — covered'
Scene 2 (4-9s): Pet emergency story
Scene 3 (10-12s): Claim process — simple
Scene 4 (13-15s): Insure your pet CTA
Tone: Pet parent empathy.`),

  T("hr-job-search", "Job Search Platform", "Finding dream job story.", "hr", 60,
    `Scene 1 (0-8s): '47 applications, zero responses'
Scene 2 (9-22s): Old job search struggle
Scene 3 (23-38s): Platform features — AI matching
Scene 4 (39-52s): Interview invitation received
Scene 5 (53-58s): Job offer — dream role
Scene 6 (59-60s): Start your search CTA
Tone: Career empowerment.`),

  T("hr-recruiting", "Recruiting Tool", "Hire faster and better.", "hr", 30,
    `Scene 1 (0-4s): 'We filled 3 positions in one week'
Scene 2 (5-14s): Candidate sourcing speed
Scene 3 (15-22s): AI screening saving time
Scene 4 (23-27s): Quality of hire metric
Scene 5 (28-30s): Post your first job CTA
Tone: Efficiency-driven.`),

  T("hr-employer-brand", "Employer Brand", "Top talent choosing company.", "hr", 30,
    `Scene 1 (0-4s): 'We get 500 applications per role'
Scene 2 (5-14s): Culture showcase
Scene 3 (15-22s): Employee testimonial
Scene 4 (23-27s): Benefits and perks
Scene 5 (28-30s): See open roles CTA
Tone: Aspirational employer.`),

  T("ngo-impact", "Impact Story", "Donation impact made tangible.", "ngo", 60,
    `Scene 1 (0-8s): Beneficiary story — before
Scene 2 (9-22s): Program helping them
Scene 3 (23-38s): Life changed
Scene 4 (39-52s): Scale of impact — numbers
Scene 5 (53-58s): $X = one life changed
Scene 6 (59-60s): Donate now CTA
Tone: Emotional but factual.`),

  T("ngo-recurring", "Monthly Giving", "Recurring donation compounding effect.", "ngo", 30,
    `Scene 1 (0-4s): '$10 a month, 3 meals a day for a child'
Scene 2 (5-14s): How recurring donations compound
Scene 3 (15-22s): Impact over 12 months
Scene 4 (23-27s): Cancel anytime reassurance
Scene 5 (28-30s): Give monthly CTA
Tone: Tangible impact.`),

  T("ngo-awareness", "Awareness Campaign", "Issue education to drive action.", "ngo", 60,
    `Scene 1 (0-8s): Shocking statistic
Scene 2 (9-22s): Issue explained — who it affects
Scene 3 (23-38s): What's being done
Scene 4 (39-52s): How viewer can help
Scene 5 (53-58s): Share and amplify
Scene 6 (59-60s): Act now CTA
Tone: Urgency and hope.`),

  T("pet-owner-story", "Pet Owner Story", "Dog/cat owner product discovery.", "pet", 60,
    `Scene 1 (0-8s): Pet and owner connection moment
Scene 2 (9-22s): Problem before product
Scene 3 (23-38s): Product discovery
Scene 4 (39-52s): Pet reaction and result
Scene 5 (53-58s): How much happier the pet is
Scene 6 (59-60s): Get it for your pet CTA
Tone: Emotional pet parent.`),

  T("pet-vet", "Vet Recommended", "Veterinarian endorsement trust.", "pet", 30,
    `Scene 1 (0-4s): 'Our vet actually recommended this'
Scene 2 (5-14s): Vet explaining why
Scene 3 (15-22s): Ingredient/safety profile
Scene 4 (23-27s): Pet health improvement
Scene 5 (28-30s): Trusted by vets — shop now CTA
Tone: Health authority.`),

  T("pet-subscription", "Pet Supply Auto-Ship", "Never run out of pet supplies.", "pet", 15,
    `Scene 1 (0-3s): 'Running out at midnight? Never again'
Scene 2 (4-9s): Auto-ship setup
Scene 3 (10-12s): Discount on subscription
Scene 4 (13-15s): Set up auto-ship CTA
Tone: Convenient.`),
];


const CAT_META: Record<string, { label: string; color: string; emoji: string }> = {
  ugc:        { label: "UGC",          color: "text-violet-400 bg-violet-400/10 border-violet-400/25",  emoji: "📱" },
  testimonial:{ label: "Testimonial",  color: "text-green-400 bg-green-400/10 border-green-400/25",     emoji: "⭐" },
  promo:      { label: "Promo",        color: "text-orange-400 bg-orange-400/10 border-orange-400/25",  emoji: "🔥" },
  tutorial:   { label: "Tutorial",     color: "text-blue-400 bg-blue-400/10 border-blue-400/25",        emoji: "🎓" },
  hook:       { label: "Hook",         color: "text-red-400 bg-red-400/10 border-red-400/25",           emoji: "🎣" },
  product:    { label: "Product",      color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/25",        emoji: "📦" },
  story:      { label: "Story",        color: "text-amber-400 bg-amber-400/10 border-amber-400/25",     emoji: "📖" },
  react:      { label: "React",        color: "text-pink-400 bg-pink-400/10 border-pink-400/25",        emoji: "😂" },
  app:        { label: "App",          color: "text-lime-400 bg-lime-400/10 border-lime-400/25",        emoji: "📲" },
  b2b:        { label: "B2B",          color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/25",  emoji: "🏢" },
  seasonal:   { label: "Seasonal",     color: "text-teal-400 bg-teal-400/10 border-teal-400/25",        emoji: "🗓️" },
  ecommerce:  { label: "E-commerce",   color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25", emoji: "🛒" },
  finance:    { label: "Finance",      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",emoji: "💰" },
  health:     { label: "Health",       color: "text-rose-400 bg-rose-400/10 border-rose-400/25",        emoji: "💊" },
  beauty:     { label: "Beauty",       color: "text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/25",emoji: "💄" },
  food:       { label: "Food",         color: "text-orange-300 bg-orange-300/10 border-orange-300/25",  emoji: "🍔" },
  gaming:     { label: "Gaming",       color: "text-purple-400 bg-purple-400/10 border-purple-400/25",  emoji: "🎮" },
  real_estate:{ label: "Real Estate",  color: "text-sky-400 bg-sky-400/10 border-sky-400/25",           emoji: "🏠" },
  education:  { label: "Education",    color: "text-blue-300 bg-blue-300/10 border-blue-300/25",        emoji: "📚" },
  travel:     { label: "Travel",       color: "text-cyan-300 bg-cyan-300/10 border-cyan-300/25",        emoji: "✈️" },
  igaming:    { label: "iGaming",      color: "text-purple-300 bg-purple-300/10 border-purple-300/25",  emoji: "🎰" },
  fintech:    { label: "Fintech",      color: "text-emerald-300 bg-emerald-300/10 border-emerald-300/25",emoji: "💳" },
  saas:       { label: "SaaS",         color: "text-blue-400 bg-blue-400/10 border-blue-400/25",        emoji: "☁️" },
  fitness:    { label: "Fitness",      color: "text-green-400 bg-green-400/10 border-green-400/25",     emoji: "💪" },
  fashion:    { label: "Fashion",      color: "text-pink-300 bg-pink-300/10 border-pink-300/25",        emoji: "👗" },
  automotive: { label: "Automotive",   color: "text-zinc-400 bg-zinc-400/10 border-zinc-400/25",        emoji: "🚗" },
  crypto:     { label: "Crypto",       color: "text-yellow-300 bg-yellow-300/10 border-yellow-300/25",  emoji: "₿" },
  insurance:  { label: "Insurance",    color: "text-slate-400 bg-slate-400/10 border-slate-400/25",     emoji: "🛡️" },
  hr:         { label: "HR",           color: "text-violet-300 bg-violet-300/10 border-violet-300/25",  emoji: "👥" },
  ngo:        { label: "NGO",          color: "text-rose-300 bg-rose-300/10 border-rose-300/25",        emoji: "❤️" },
  pet:        { label: "Pet",          color: "text-amber-300 bg-amber-300/10 border-amber-300/25",     emoji: "🐾" },
};

const CATEGORIES: Array<{ value: Category; label: string; emoji: string }> = [
  { value: "all", label: "All", emoji: "🌐" },
  ...Object.entries(CAT_META).map(([k, v]) => ({ value: k as Category, label: v.label, emoji: v.emoji })),
];

// Helper to get translated template name/desc
const useTranslatedTemplate = (template: Template, lang: string) => {
  const tt = lang !== "en" ? getTemplateTranslation(template.id, lang) : null;
  return {
    name: tt?.name || template.name,
    description: tt?.desc || template.description,
  };
};

const PER_PAGE = 24;

const getCatAccent = (cat: string): string => {
  const map: Record<string, string> = {
    ugc: "#a78bfa", testimonial: "#34d399", promo: "#fb923c", tutorial: "#60a5fa",
    hook: "#f87171", product: "#22d3ee", story: "#fbbf24", react: "#f472b6",
    app: "#a3e635", b2b: "#818cf8", seasonal: "#2dd4bf", ecommerce: "#facc15",
    finance: "#34d399", health: "#fb7185", beauty: "#e879f9", food: "#fb923c",
    gaming: "#c084fc", real_estate: "#38bdf8", education: "#93c5fd", travel: "#67e8f9",
    igaming: "#c084fc", fintech: "#6ee7b7", saas: "#60a5fa", fitness: "#4ade80",
    fashion: "#f9a8d4", automotive: "#a1a1aa", crypto: "#fde047", insurance: "#94a3b8",
    hr: "#a78bfa", ngo: "#fda4af", pet: "#fcd34d",
  };
  return map[cat] || "#a78bfa";
};

const TemplatesPage = () => {
  const { user, profile } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const ot = useObT(language);
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [activeDuration, setActiveDuration] = useState<Duration>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [translateModal, setTranslateModal] = useState<Template | null>(null);

  const filtered = useMemo(() => {
    setPage(1);
    return TEMPLATES.filter((t) => {
      if (activeCategory !== "all" && t.category !== activeCategory) return false;
      if (activeDuration !== "all" && String(t.duration) !== activeDuration) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q) && !t.category.includes(q)) return false;
      }
      return true;
    });
  }, [activeCategory, activeDuration, search]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleUse = async (template: Template, translatedPrompt?: string, lang?: string) => {
    setLoading(template.id);
    try {
      await supabase.from("template_usage" as never).insert({
        user_id: user.id,
        template_id: template.id,
        template_name: template.name,
      } as never);
    } catch {}
    navigate("/dashboard/boards/new", {
      state: {
        templatePrompt: translatedPrompt || template.prompt,
        templateName: lang ? `${template.name} (${LANGUAGES.find(l => l.code === lang)?.name || lang})` : template.name,
        templateDuration: template.duration,
        templateLang: lang,
      },
    });
    setLoading(null);
  };

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: TEMPLATES.length };
    TEMPLATES.forEach((t) => { counts[t.category] = (counts[t.category] || 0) + 1; });
    return counts;
  }, []);

  const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
  const mono = { fontFamily: "'DM Mono', monospace" } as const;

  return (
    <div className="relative flex flex-col min-h-screen">
      {translateModal && (
        <TranslateModal
          template={translateModal}
          onClose={() => setTranslateModal(null)}
          onUse={handleUse}
          userId={user.id}
        />
      )}
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-3 sm:space-y-4 flex-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
           <h1 className="text-xl font-bold text-white flex items-center gap-2" style={syne}>
            <Layers className="h-5 w-5" style={{ color: "#a78bfa" }} /> {ot("tp_title")}
          </h1>
          <p className="text-white/30 text-xs mt-1">
            <span className="text-white/50 font-semibold">{TEMPLATES.length}</span> {ot("tp_formats")} · {Object.keys(CAT_META).length} {ot("tp_industries")} ·{" "}
            <span style={{ color: "#34d399" }}>
              <Globe className="h-3 w-3 inline -mt-0.5 mr-0.5" />18 {ot("tp_languages")}
            </span>
          </p>
        </div>
        <span className="text-[11px] text-white/20 shrink-0 mt-1" style={mono}>{filtered.length} {ot("tp_shown")}</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={ot("tp_search_ph")}
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm outline-none transition-colors"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#fff" }}
        />
      </div>

      {/* Category pills — horizontal scroll */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-3 sm:mx-0 px-3 sm:px-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => { setActiveCategory(cat.value); setPage(1); }}
            className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all shrink-0 min-h-[36px]"
            style={activeCategory === cat.value
              ? { background: "#fff", color: "#000", borderColor: "#fff" }
              : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.07)" }}
          >
            <span>{cat.emoji}</span>
            {(language !== "en" ? getCategoryLabel(cat.value, language) : null) || cat.label}
            {catCounts[cat.value] !== undefined && (
              <span style={{ opacity: 0.5, ...mono, fontSize: 10 }}>
                {catCounts[cat.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Duration filter */}
      <div className="flex gap-2">
        {([["all", ot("tp_any")], ["15", "15s"], ["30", "30s"], ["60", "60s"]] as [Duration, string][]).map(([d, label]) => (
          <button
            key={d}
            onClick={() => { setActiveDuration(d); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all min-h-[36px]"
            style={activeDuration === d
              ? { background: "rgba(167,139,250,0.15)", borderColor: "rgba(167,139,250,0.4)", color: "#a78bfa" }
              : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }}
          >
            <Clock className="h-3 w-3" />{label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {paginated.length === 0 ? (
        <div className="text-center py-16 text-white/20">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">{ot("tp_no_match")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
          {paginated.map((template) => {
            const meta = CAT_META[template.category];
            return (
              <div key={template.id}
                className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.99] hover:scale-[1.01]"
                style={{ background: "#111", border: "1px solid rgba(255,255,255,0.07)" }}>
                {/* Color accent top bar */}
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${getCatAccent(template.category)}, transparent)` }} />
                <div className="p-4 sm:p-4 flex flex-col flex-1">
                  {/* Category + Duration */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${meta?.color || "text-white/40 border-white/10"}`}>
                      {meta?.emoji} {meta?.label || template.category}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-white/25" style={mono}>
                      <Clock className="h-3 w-3" />{template.duration}s
                    </span>
                  </div>
                  {/* Name + desc */}
                  <h3 className="font-bold text-white text-[13px] sm:text-sm mb-1.5 leading-snug" style={syne}>
                    {template.name}
                  </h3>
                  <p className="text-xs text-white/40 mb-4 flex-1 leading-relaxed">
                    {template.description}
                  </p>
                  {/* Actions */}
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => handleUse(template)}
                      disabled={loading === template.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px]"
                      style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; (e.currentTarget as HTMLButtonElement).style.color = "#000"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                    >
                      {loading === template.id ? "Loading..." : <><span>{ot("tp_use")}</span><ArrowRight className="h-3.5 w-3.5" /></>}
                    </button>
                    <button
                      onClick={() => setTranslateModal(template)}
                      disabled={loading === template.id}
                      title="Translate to your market"
                      className="flex items-center justify-center h-11 w-11 rounded-xl transition-all"
                      style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.18)", color: "#34d399" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(52,211,153,0.18)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(52,211,153,0.08)"; }}
                    >
                      <Globe className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2 pb-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 disabled:opacity-20 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {Array.from({ length: Math.min(totalPages, typeof window !== "undefined" && window.innerWidth < 640 ? 3 : 5) }, (_, i) => {
            let p: number;
            if (totalPages <= 7) {
              p = i + 1;
            } else if (page <= 4) {
              p = i + 1;
              if (i === 6) p = totalPages;
            } else if (page >= totalPages - 3) {
              p = totalPages - 6 + i;
            } else {
              const map = [1, page - 2, page - 1, page, page + 1, page + 2, totalPages];
              p = map[i];
            }
            return (
              <button
                key={i}
                onClick={() => setPage(p)}
                className={`h-8 min-w-[2rem] px-2 rounded-lg text-xs font-mono transition-all ${
                  p === page
                    ? "bg-white text-black font-bold"
                    : "bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white hover:border-white/20"
                }`}
              >
                {p}
              </button>
            );
          })}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 disabled:opacity-20 transition-all"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>

    {/* Sticky upgrade CTA */}
    {profile?.plan === "free" && (
      <div className="sticky bottom-0 z-20 px-3 sm:px-5 pb-3 sm:pb-4 pt-2 pointer-events-none">
        <div className="pointer-events-auto relative rounded-2xl border border-white/[0.12] overflow-hidden backdrop-blur-xl bg-[#0a0a0a]/80 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/25 to-pink-900/20 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5 justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">Unlock all {TEMPLATES.length} templates ⚡</p>
              <p className="text-xs text-white/35">Studio plan · 30 analyses · 30 boards · unlimited hooks</p>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-white/90 active:scale-95 transition-all"
            >
              Upgrade <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default TemplatesPage;
