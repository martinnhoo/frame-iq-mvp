import { Button } from "@/components/ui/button";
import { Video, FileText, Globe, Brain, Sparkles, Zap, ArrowLeft, ArrowRight, Menu, Play, Check } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/Logo";

const featureMeta: Record<string, {
  icon: any;
  title: string;
  headline: string;
  description: string;
  details: string[];
}> = {
  "video-analysis": {
    icon: Video,
    title: "Video Analysis",
    headline: "Upload any ad. Get a full breakdown in 60 seconds.",
    description: "AdBrief's AI engine watches your video, extracts the hook, identifies the creative model, transcribes the audio, and generates a production-ready brief — all automatically.",
    details: [
      "Automatic hook extraction from the first 3 seconds with emotional trigger classification",
      "Creative model identification: UGC, talking head, product demo, listicle, comparison, and 12 more",
      "Full audio transcription with speaker detection and timestamp mapping",
      "Key frame extraction with scene-by-scene visual breakdown",
      "Predicted CTR and hook score based on analysis of 2.4M+ ads",
      "Auto-translation of any language into English for global teams",
    ],
  },
  "board-generation": {
    icon: FileText,
    title: "Board Generation",
    headline: "From prompt to production board in 30 seconds.",
    description: "Describe your ad concept in plain text. AdBrief generates a complete production board with scene breakdowns, voiceover scripts, editor notes, and visual direction.",
    details: [
      "Scene-by-scene breakdown with timing, transitions, and visual direction",
      "Full voiceover script with tone, pacing, and delivery notes",
      "Editor notes with specific technical direction for each scene",
      "Visual references pulled from top-performing ads in your niche",
      "Export to Notion, Google Docs, PDF, or share via link",
      "Powered by analysis of millions of high-performing ad structures",
    ],
  },
  "auto-translation": {
    icon: Globe,
    title: "Auto Translation",
    headline: "Any language in. English out. Instantly.",
    description: "Upload ads in any language — Portuguese, Spanish, Japanese, Arabic — and AdBrief automatically transcribes and translates everything to English so your global team stays aligned.",
    details: [
      "Support for 40+ languages with native speaker-level accuracy",
      "Context-aware translation that preserves marketing intent, not just words",
      "Automatic detection of slang, idioms, and cultural references",
      "Side-by-side original and translated transcripts",
      "Translation of on-screen text and overlay copy",
      "Perfect for multi-market teams running BR, MX, IN and other markets simultaneously",
    ],
  },
  "creative-intelligence": {
    icon: Brain,
    title: "Creative Intelligence",
    headline: "Classify every ad. Decode every pattern.",
    description: "AdBrief automatically classifies ads by creative format, extracts hooks, identifies CTAs, and maps the entire creative structure so you can replicate what works.",
    details: [
      "15+ creative model classifications (UGC, talking head, product demo, comparison, etc.)",
      "Hook pattern taxonomy: curiosity gap, pattern interrupt, direct benefit, social proof",
      "CTA mapping with timestamp and conversion pattern identification",
      "Audience signal detection from visual and verbal cues",
      "Creative fatigue prediction based on format saturation in your niche",
      "Weekly trend reports on emerging creative patterns by vertical",
    ],
  },
  "pre-flight-check": {
    icon: Sparkles,
    title: "Pre-flight Check",
    headline: "Catch errors before they cost you.",
    description: "AI reads your script before it goes to the editor — checks hook strength, compliance rules, CTA effectiveness, and platform fit. Market-specific rules built in for BR, MX, IN, US, GB and more.",
    details: [
      "Full script analysis: hook score, structure, CTA, and narrative flow",
      "Compliance rules per market — BR ('autorizado' not 'legalizado'), GB (UKGC), IN (skill game), US (state laws)",
      "Platform-specific checks: TikTok, Reels, Facebook, YouTube Shorts, Google UAC",
      "Language review — catches wrong words, banned phrases, and tone mismatches",
      "AI-suggested hook rewrite if score < 7",
      "Cross-platform fit check: primary platform + crosspost recommendations",
    ],
  },
  "api-access": {
    icon: Zap,
    title: "API Access",
    headline: "Plug AdBrief into your stack.",
    description: "REST API with full access to video analysis, board generation, and creative intelligence. Build AdBrief into your internal tools, dashboards, and automation workflows.",
    details: [
      "RESTful API with comprehensive documentation and SDKs",
      "Webhook support for real-time analysis completion notifications",
      "Batch processing: analyze up to 100 scripts and videos per API call",
      "Integration templates for Notion, Slack, Google Sheets, and Zapier",
      "Rate limits scaled to your plan (up to 10K requests/day on Enterprise)",
      "99.9% uptime SLA with dedicated support for API customers",
    ],
  },
};

/* ── Unique demo card per feature ── */

const VideoAnalysisDemo = () => (
  <div style={{ background: 'linear-gradient(180deg, #0c0c0c, #080808)', padding: '28px' }}>
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
          <Video className="w-5 h-5 text-white" />
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>nike_running_campaign_q1.mp4</div>
          <div style={{ color: '#555', fontSize: '12px', fontFamily: '"DM Mono", monospace' }}>Uploaded just now</div>
        </div>
      </div>
      <div className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)' }}>
        <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 500 }}>● Analysis Complete</span>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-xl" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
      <div>
        <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>Creative Model</div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }}>Studio</span>
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: 600 }}>Product Demo</span>
        </div>
      </div>
      <div>
        <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>Hook Score</div>
        <span style={{ color: '#4ade80', fontSize: '28px', fontWeight: 700 }}>8.7</span>
        <span style={{ color: '#444', fontSize: '14px' }}> / 10</span>
      </div>
      <div>
        <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>Predicted CTR</div>
        <span style={{ color: '#fff', fontSize: '28px', fontWeight: 700 }}>4.1%</span>
        <span style={{ color: '#4ade80', fontSize: '12px', marginLeft: 4 }}>↑ 62%</span>
      </div>
    </div>

    <div className="p-4 rounded-xl mb-4" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
      <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Hook (0–3s)</div>
      <p style={{ color: '#e5e5e5', fontSize: '14px', lineHeight: '1.6', fontFamily: '"DM Mono", monospace' }}>
        "Slow-motion close-up of running shoe hitting wet pavement, VO: <span style={{ color: '#a78bfa' }}>'Every millisecond counts — we engineered 14 of them.'</span>"
      </p>
    </div>

    <div className="p-4 rounded-xl mb-4" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
      <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>Brief</div>
      <p style={{ color: '#aaa', fontSize: '13px', lineHeight: '1.7', fontFamily: '"DM Mono", monospace', fontStyle: 'italic' }}>
        Studio product demo for Nike running campaign. High-production close-ups with performance data overlay. Aspirational VO with technical credibility. CTA at 00:18 with urgency driver. Vertical 9:16 optimized for Reels/Stories.
      </p>
    </div>

    <div className="flex flex-wrap gap-2">
      {['🌐 EN', '⏱ 0:30', '📍 Global', '👟 Sports', '🏃 Athletes 18-35'].map(b => (
        <span key={b} style={{ background: '#141414', border: '1px solid #222', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#888' }}>{b}</span>
      ))}
    </div>
  </div>
);

const BoardGenerationDemo = () => {
  const scenes = [
    { time: "00:00 – 00:03", label: "Hook", desc: "Phone notification: 'You saved $247 this month.' Thumb taps.", vo: "No voiceover — natural sound only.", note: "Screen recording feel. Real notification animation." },
    { time: "00:03 – 00:08", label: "Problem", desc: "Quick cuts: bills, receipts, bank app with red numbers.", vo: "\"We all know that feeling. Money in, money... gone.\"", note: "Fast pacing. Use stock + UGC mix." },
    { time: "00:08 – 00:15", label: "Solution", desc: "App dashboard reveal. Savings graph going up.", vo: "\"Until one app changed everything for me.\"", note: "Smooth zoom into phone screen. Clean UI." },
    { time: "00:15 – 00:20", label: "Features", desc: "Split screen: round-ups, cashback, auto-invest.", vo: "\"Round-ups. Cashback. Auto-invest. All on autopilot.\"", note: "3 quick feature demos. 2s each." },
    { time: "00:20 – 00:25", label: "CTA", desc: "App store button + promo code overlay.", vo: "\"Download free. Your future self will thank you.\"", note: "Urgency driver: 'Limited time: 2x cashback'" },
  ];

  return (
    <div style={{ background: 'linear-gradient(180deg, #0c0c0c, #080808)', padding: '28px' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>Fintech App Launch — UGC Board</div>
            <div style={{ color: '#555', fontSize: '12px', fontFamily: '"DM Mono", monospace' }}>5 scenes · 25s · Generated in 12s</div>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 500 }}>● Board Ready</span>
        </div>
      </div>

      {/* Scene timeline */}
      <div className="space-y-3">
        {scenes.map((scene, i) => (
          <div key={i} className="flex gap-4 p-3 rounded-xl" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
            <div className="shrink-0 w-20 pt-1">
              <div style={{ color: '#60a5fa', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>{scene.time}</div>
              <div className="mt-1 px-2 py-0.5 rounded text-[10px] font-semibold inline-block" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd' }}>{scene.label}</div>
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: '#e5e5e5', fontSize: '13px', lineHeight: 1.5 }}>{scene.desc}</p>
              <p style={{ color: '#a78bfa', fontSize: '12px', fontFamily: '"DM Mono", monospace', marginTop: 4 }}>{scene.vo}</p>
              <p style={{ color: '#555', fontSize: '11px', marginTop: 4, fontStyle: 'italic' }}>📝 {scene.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        {['📱 9:16 Vertical', '💰 Fintech', '🎯 App Install'].map(b => (
          <span key={b} style={{ background: '#141414', border: '1px solid #222', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#888' }}>{b}</span>
        ))}
      </div>
    </div>
  );
};

const AutoTranslationDemo = () => (
  <div style={{ background: 'linear-gradient(180deg, #0c0c0c, #080808)', padding: '28px' }}>
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22c55e, #059669)' }}>
          <Globe className="w-5 h-5 text-white" />
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>betano_promo_futebol_br.mp4</div>
          <div style={{ color: '#555', fontSize: '12px', fontFamily: '"DM Mono", monospace' }}>PT-BR → EN · Translated in 8s</div>
        </div>
      </div>
      <div className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
        <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 500 }}>● Translated</span>
      </div>
    </div>

    {/* Side by side */}
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div className="p-4 rounded-xl" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🇧🇷</span>
          <span style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>Original (PT-BR)</span>
        </div>
        <div className="space-y-3" style={{ fontFamily: '"DM Mono", monospace', fontSize: '12px', lineHeight: 1.7 }}>
          <p style={{ color: '#888' }}><span style={{ color: '#555', fontSize: '10px' }}>00:00</span> "Cê não tá pronto pro que eu vou te falar."</p>
          <p style={{ color: '#888' }}><span style={{ color: '#555', fontSize: '10px' }}>00:03</span> "As odds de hoje tão absurdas, mano."</p>
          <p style={{ color: '#888' }}><span style={{ color: '#555', fontSize: '10px' }}>00:07</span> "Flamengo pagando 2.40 contra o Palmeiras?"</p>
          <p style={{ color: '#888' }}><span style={{ color: '#555', fontSize: '10px' }}>00:11</span> "Usa meu código FUTE10 e ganha R$10 grátis."</p>
          <p style={{ color: '#888' }}><span style={{ color: '#555', fontSize: '10px' }}>00:16</span> "Corre que é por tempo limitado!"</p>
        </div>
      </div>
      <div className="p-4 rounded-xl" style={{ background: '#0f0f0f', border: '1px solid rgba(34, 197, 94, 0.15)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🇺🇸</span>
          <span style={{ color: '#4ade80', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>Translated (EN)</span>
        </div>
        <div className="space-y-3" style={{ fontFamily: '"DM Mono", monospace', fontSize: '12px', lineHeight: 1.7 }}>
          <p style={{ color: '#e5e5e5' }}><span style={{ color: '#555', fontSize: '10px' }}>00:00</span> "You're not ready for what I'm about to tell you."</p>
          <p style={{ color: '#e5e5e5' }}><span style={{ color: '#555', fontSize: '10px' }}>00:03</span> "Today's odds are insane, bro."</p>
          <p style={{ color: '#e5e5e5' }}><span style={{ color: '#555', fontSize: '10px' }}>00:07</span> "Flamengo at 2.40 against Palmeiras?"</p>
          <p style={{ color: '#e5e5e5' }}><span style={{ color: '#555', fontSize: '10px' }}>00:11</span> "Use my code FUTE10 and get $10 free."</p>
          <p style={{ color: '#e5e5e5' }}><span style={{ color: '#555', fontSize: '10px' }}>00:16</span> "Hurry, it's for a limited time only!"</p>
        </div>
      </div>
    </div>

    <div className="p-3 rounded-xl mb-4" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
      <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px' }}>AI Translation Notes</div>
      <p style={{ color: '#888', fontSize: '12px', fontFamily: '"DM Mono", monospace' }}>
        "Cê" → informal contraction of "você" (you). "Mano" → slang for "bro". "Odds" kept as-is (iGaming terminology). Cultural context preserved while adapting slang register.
      </p>
    </div>

    <div className="flex flex-wrap gap-2">
      {['🌐 PT-BR → EN', '⏱ 0:22', '📍 BR Market', '🎮 iGaming', '⚽ Sports 21-45'].map(b => (
        <span key={b} style={{ background: '#141414', border: '1px solid #222', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#888' }}>{b}</span>
      ))}
    </div>
  </div>
);

const CreativeIntelligenceDemo = () => {
  const classifications = [
    { label: "UGC Testimonial", pct: 34, color: '#a78bfa' },
    { label: "Product Demo", pct: 28, color: '#60a5fa' },
    { label: "Problem-Solution", pct: 18, color: '#f472b6' },
    { label: "Comparison", pct: 12, color: '#4ade80' },
    { label: "Listicle", pct: 8, color: '#fbbf24' },
  ];
  const hooks = [
    { type: "Curiosity Gap", count: 127, trend: "↑ 15%", trendColor: '#4ade80' },
    { type: "Pattern Interrupt", count: 94, trend: "↑ 8%", trendColor: '#4ade80' },
    { type: "Direct Benefit", count: 81, trend: "→ 0%", trendColor: '#888' },
    { type: "Social Proof", count: 63, trend: "↓ 5%", trendColor: '#ef4444' },
  ];

  return (
    <div style={{ background: 'linear-gradient(180deg, #0c0c0c, #080808)', padding: '28px' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)' }}>
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>Beauty Vertical — Weekly Intelligence Report</div>
            <div style={{ color: '#555', fontSize: '12px', fontFamily: '"DM Mono", monospace' }}>348 ads analyzed · 12 competitors · Mar 3–9, 2026</div>
          </div>
        </div>
      </div>

      {/* Format distribution */}
      <div className="p-4 rounded-xl mb-4" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
        <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px' }}>Creative Format Distribution</div>
        <div className="space-y-3">
          {classifications.map(c => (
            <div key={c.label} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-xs font-medium" style={{ color: c.color }}>{c.label}</div>
              <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, background: c.color, opacity: 0.6 }} />
              </div>
              <div className="w-10 text-right text-xs font-mono" style={{ color: '#888' }}>{c.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Hook trends */}
      <div className="p-4 rounded-xl mb-4" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
        <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px' }}>Hook Pattern Trends (This Week)</div>
        <div className="grid grid-cols-2 gap-3">
          {hooks.map(h => (
            <div key={h.type} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: '#141414' }}>
              <div>
                <div style={{ color: '#e5e5e5', fontSize: '13px', fontWeight: 500 }}>{h.type}</div>
                <div style={{ color: '#666', fontSize: '11px', fontFamily: '"DM Mono", monospace' }}>{h.count} ads</div>
              </div>
              <span style={{ color: h.trendColor, fontSize: '12px', fontWeight: 600 }}>{h.trend}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Key insight */}
      <div className="p-3 rounded-xl" style={{ background: 'rgba(249, 115, 22, 0.05)', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
        <div style={{ color: '#f97316', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px', fontWeight: 600 }}>💡 Key Insight</div>
        <p style={{ color: '#ccc', fontSize: '13px', lineHeight: 1.6 }}>
          Curiosity gap hooks grew 15% this week in Beauty. Competitors shifting from Social Proof to Curiosity — recommend testing 3 new curiosity hooks with your top UGC creators.
        </p>
      </div>
    </div>
  );
};

const AIVideoGenerationDemo = () => {
  const timeline = [
    { scene: 1, label: "Hook", status: "rendered", duration: "3s" },
    { scene: 2, label: "Problem", status: "rendered", duration: "5s" },
    { scene: 3, label: "Solution Reveal", status: "rendered", duration: "6s" },
    { scene: 4, label: "Feature Demo", status: "rendered", duration: "5s" },
    { scene: 5, label: "Social Proof", status: "rendered", duration: "3s" },
    { scene: 6, label: "CTA", status: "rendered", duration: "2s" },
  ];

  return (
    <div style={{ background: 'linear-gradient(180deg, #0c0c0c, #080808)', padding: '28px' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>gymshark_summer_drop.mp4</div>
            <div style={{ color: '#555', fontSize: '12px', fontFamily: '"DM Mono", monospace' }}>Generated from board · 6 scenes · 24s</div>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
          <span style={{ fontSize: '12px', color: '#f472b6', fontWeight: 500 }}>● Ready to Export</span>
        </div>
      </div>

      {/* Video preview placeholder */}
      <div className="rounded-xl mb-4 flex items-center justify-center relative overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', height: '180px' }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08), rgba(139, 92, 246, 0.05))' }} />
        <div className="relative flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(236, 72, 153, 0.2)', border: '1px solid rgba(236, 72, 153, 0.4)' }}>
            <Play className="w-6 h-6 text-pink-400 ml-0.5" />
          </div>
          <span style={{ color: '#888', fontSize: '12px' }}>Preview: gymshark_summer_drop.mp4 · 9:16</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4 rounded-xl mb-4" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
        <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px' }}>Scene Timeline</div>
        <div className="flex gap-1.5">
          {timeline.map((s) => (
            <div key={s.scene} className="flex-1 text-center">
              <div className="rounded-lg py-2 mb-1.5 relative overflow-hidden" style={{ background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
                <div className="text-xs font-semibold" style={{ color: '#f472b6' }}>{s.label}</div>
                <div className="text-[10px] mt-0.5" style={{ color: '#666' }}>{s.duration}</div>
              </div>
              <Check className="w-3 h-3 text-green-500 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Generation details */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl text-center" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Voice</div>
          <div style={{ color: '#e5e5e5', fontSize: '13px', fontWeight: 600 }}>Emma (US)</div>
          <div style={{ color: '#555', fontSize: '11px' }}>Motivational</div>
        </div>
        <div className="p-3 rounded-xl text-center" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Format</div>
          <div style={{ color: '#e5e5e5', fontSize: '13px', fontWeight: 600 }}>9:16</div>
          <div style={{ color: '#555', fontSize: '11px' }}>Stories / Reels</div>
        </div>
        <div className="p-3 rounded-xl text-center" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Render</div>
          <div style={{ color: '#e5e5e5', fontSize: '13px', fontWeight: 600 }}>47s</div>
          <div style={{ color: '#555', fontSize: '11px' }}>1080p</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['🌐 EN', '⏱ 0:24', '📍 Global', '👕 Fashion', '💪 Fitness 18-30'].map(b => (
          <span key={b} style={{ background: '#141414', border: '1px solid #222', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#888' }}>{b}</span>
        ))}
      </div>
    </div>
  );
};

const APIAccessDemo = () => (
  <div style={{ background: 'linear-gradient(180deg, #0c0c0c, #080808)', padding: '28px' }}>
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)' }}>
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>API Response — Batch Analysis</div>
          <div style={{ color: '#555', fontSize: '12px', fontFamily: '"DM Mono", monospace' }}>POST /v1/analyze/batch · 200 OK · 3.2s</div>
        </div>
      </div>
      <div className="px-3 py-1.5 rounded-full" style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.3)' }}>
        <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 500 }}>● 24/24 Complete</span>
      </div>
    </div>

    {/* Code block */}
    <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #1a1a1a' }}>
      <div className="px-4 py-2 flex items-center gap-2" style={{ background: '#141414', borderBottom: '1px solid #1a1a1a' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: '#4ade80' }} />
        <span style={{ color: '#666', fontSize: '11px', fontFamily: '"DM Mono", monospace' }}>response.json</span>
      </div>
      <pre className="p-4 overflow-x-auto" style={{ background: '#0a0a0a', margin: 0 }}>
        <code style={{ fontFamily: '"DM Mono", monospace', fontSize: '12px', lineHeight: 1.8 }}>
{`{
  `}<span style={{ color: '#a78bfa' }}>"batch_id"</span>{`: `}<span style={{ color: '#4ade80' }}>"batch_stake_q1_2026"</span>{`,
  `}<span style={{ color: '#a78bfa' }}>"total_ads"</span>{`: `}<span style={{ color: '#fbbf24' }}>24</span>{`,
  `}<span style={{ color: '#a78bfa' }}>"avg_hook_score"</span>{`: `}<span style={{ color: '#fbbf24' }}>8.1</span>{`,
  `}<span style={{ color: '#a78bfa' }}>"top_creative_model"</span>{`: `}<span style={{ color: '#4ade80' }}>"UGC Sports Promo"</span>{`,
  `}<span style={{ color: '#a78bfa' }}>"winning_hooks"</span>{`: `}<span style={{ color: '#fbbf24' }}>3</span>{`,
  `}<span style={{ color: '#a78bfa' }}>"underperforming"</span>{`: `}<span style={{ color: '#fbbf24' }}>6</span>{`,
  `}<span style={{ color: '#a78bfa' }}>"recommendation"</span>{`: `}<span style={{ color: '#4ade80' }}>"Pause 6 ads, scale 3 winners"</span>{`,
  `}<span style={{ color: '#a78bfa' }}>"markets"</span>{`: [`}<span style={{ color: '#4ade80' }}>"BR"</span>{`, `}<span style={{ color: '#4ade80' }}>"LATAM"</span>{`, `}<span style={{ color: '#4ade80' }}>"EU"</span>{`, `}<span style={{ color: '#4ade80' }}>"US"</span>{`]
}`}
        </code>
      </pre>
    </div>

    {/* Request stats */}
    <div className="grid grid-cols-4 gap-3 mb-4">
      {[
        { label: "Latency", value: "3.2s" },
        { label: "Ads Processed", value: "24" },
        { label: "Rate Limit", value: "847/1000" },
        { label: "Credits Used", value: "24" },
      ].map(s => (
        <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
          <div style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>{s.label}</div>
          <div style={{ color: '#e5e5e5', fontSize: '15px', fontWeight: 700, fontFamily: '"DM Mono", monospace' }}>{s.value}</div>
        </div>
      ))}
    </div>

    <div className="flex flex-wrap gap-2">
      {['🔗 REST API', '📊 Batch 24', '📍 Multi-market', '🎰 iGaming', '📈 Analytics'].map(b => (
        <span key={b} style={{ background: '#141414', border: '1px solid #222', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#888' }}>{b}</span>
      ))}
    </div>
  </div>
);

const demoComponents: Record<string, () => JSX.Element> = {
  "video-analysis": VideoAnalysisDemo,
  "board-generation": BoardGenerationDemo,
  "auto-translation": AutoTranslationDemo,
  "creative-intelligence": CreativeIntelligenceDemo,
  "pre-flight-check": VideoAnalysisDemo,
  "api-access": APIAccessDemo,
};

const FeatureDetail = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const feature = slug ? featureMeta[slug] : null;
  const DemoComponent = slug ? demoComponents[slug] : null;

  if (!feature) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Feature not found</h1>
          <Button variant="ghost" onClick={() => navigate("/#features")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to features
          </Button>
        </div>
      </div>
    );
  }

  const Icon = feature.icon;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo size="lg" />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/#features" className="text-sm text-foreground transition-colors">Features</Link>
            <Link to="/#pricing" className="text-sm text-secondary hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/blog" className="text-sm text-secondary hover:text-foreground transition-colors">Blog</Link>
            <Link to="/contact" className="text-sm text-secondary hover:text-foreground transition-colors">Contact</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" className="text-secondary hover:text-foreground" onClick={() => navigate("/login")}>Sign in</Button>
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0" onClick={() => navigate("/signup")}>Get started free</Button>
          </div>
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon"><Menu className="h-6 w-6" /></Button>
            </SheetTrigger>
            <SheetContent>
              <div className="flex flex-col gap-6 mt-8">
                <Link to="/" className="text-lg text-secondary hover:text-foreground">Home</Link>
                <Link to="/blog" className="text-lg text-secondary hover:text-foreground">Blog</Link>
                <Link to="/contact" className="text-lg text-secondary hover:text-foreground">Contact</Link>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white" onClick={() => navigate("/signup")}>Get started</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Button variant="ghost" className="text-secondary mb-8 -ml-4" onClick={() => navigate("/#features")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> All features
            </Button>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div>
                <span className="text-sm font-semibold tracking-wider uppercase gradient-text">{feature.title}</span>
                <h1 className="text-3xl md:text-4xl font-bold">{feature.headline}</h1>
              </div>
            </div>

            <p className="text-secondary text-lg leading-relaxed mb-12 max-w-3xl">{feature.description}</p>

            <div className="grid md:grid-cols-2 gap-4 mb-16">
              {feature.details.map((detail, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(139, 92, 246, 0.03)', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                  <span className="text-purple-400 mt-0.5">✓</span>
                  <span className="text-sm text-secondary leading-relaxed">{detail}</span>
                </div>
              ))}
            </div>

            {/* Demo Card */}
            <div className="text-center mb-4">
              <span style={{ color: '#555', fontSize: '11px', letterSpacing: '3px', fontWeight: 600 }}>LIVE EXAMPLE</span>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ boxShadow: '0 40px 100px rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(139, 92, 246, 0.2)' }}>
              {/* Browser Chrome */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'linear-gradient(180deg, #1a1a1a, #141414)', borderBottom: '1px solid #2a2a2a' }}>
                <div className="flex gap-2">
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
                </div>
                <div className="flex-1 text-center mx-12" style={{ background: '#0a0a0a', borderRadius: '8px', padding: '6px 16px', fontSize: '12px', color: '#666', fontFamily: '"DM Mono", monospace', border: '1px solid #222' }}>
                  <span style={{ color: '#4ade80' }}>🔒</span> app.adbrief.pro
                </div>
                <div className="w-16" />
              </div>

              {DemoComponent && <DemoComponent />}
            </div>

            <div className="text-center mt-16">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0 px-8 py-4 h-auto text-base rounded-xl" onClick={() => navigate("/signup")}>
                Try {feature.title} for free <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default FeatureDetail;
