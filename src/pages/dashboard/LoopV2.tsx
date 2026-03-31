import { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import UpgradeWall from "@/components/UpgradeWall";
import { isFree, chatDailyLimit } from "@/lib/planLimits";
import { useDashT } from "@/i18n/dashboardTranslations";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Send, Loader2, ArrowRight, Sparkles, Brain,
  BarChart3, Zap, FileText, Target, Upload, RefreshCw,
  AlertCircle, ExternalLink,
} from "lucide-react";

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
const BLUE = "#0ea5e9";
const TEAL = "#06b6d4";
const GREEN = "#34d399";
const AMBER = "#fbbf24";
const RED = "#f87171";
const PURPLE = "#a78bfa";

interface AccountPulse {
  avgHookScore: number | null;
  totalAnalyses: number;
  topFormat: string | null;
  topMarket: string | null;
  weeklyDelta: number | null;
  viralHooks: number;
  recentActivity: { title: string; score: number | null; ts: string }[];
  platformImports: { platform: string; count: number }[];
  connections: { platform: string; status: string; ad_accounts: any[] }[];
}

interface AIBlock {
  type: "insight" | "action" | "warning" | "pattern" | "hooks" | "navigate" | "data" | "tool_call" | "tool_result";
  title: string; content?: string; items?: string[];
  route?: string; cta?: string; data?: Record<string, string>;
  // tool_call specific
  tool?: "hooks" | "script" | "brief" | "competitor" | "translate" | "preflight";
  tool_params?: Record<string, string>;
  // tool_result specific
  tool_name?: string; result_items?: string[]; result_content?: string;
}
interface AIMessage {
  role: "user" | "assistant";
  text?: string; blocks?: AIBlock[]; ts: number; loading?: boolean;
}

const BLOCK_COLORS: Record<string, string> = {
  insight: GREEN, action: BLUE, warning: AMBER,
  pattern: PURPLE, hooks: TEAL, navigate: BLUE, data: "rgba(255,255,255,0.5)",
  tool_call: TEAL, tool_result: GREEN,
};

// SVG logos for platforms — real brand icons
const MetaLogo = ({ size = 16, active = false }: { size?: number; active?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z" fill={active ? "#60a5fa" : "rgba(255,255,255,0.3)"} />
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8.5 16.5v-9l7 4.5-7 4.5z" fill="none" />
    {/* Meta f */}
    <text x="6" y="17" fontSize="13" fontWeight="900" fill={active ? "#60a5fa" : "rgba(255,255,255,0.3)"} fontFamily="sans-serif">f</text>
  </svg>
);

// Platform config with real brand colors
const PLATFORMS = [
  {
    id: "meta", label: "Meta Ads", fn: "meta-oauth",
    color: "#1877F2", activeColor: "#60a5fa",
    icon: ({ active }: { active: boolean }) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "#60a5fa" : "rgba(255,255,255,0.3)"}>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: "tiktok", label: "TikTok Ads", fn: "tiktok-oauth",
    color: "#000000", activeColor: "#06b6d4",
    icon: ({ active }: { active: boolean }) => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "#06b6d4" : "rgba(255,255,255,0.3)"}>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.72a4.85 4.85 0 0 1-1.01-.03z"/>
      </svg>
    ),
  },
  {
    id: "google", label: "Google Ads", fn: "google-oauth",
    color: "#4285F4", activeColor: "#34d399",
    icon: ({ active }: { active: boolean }) => (
      <svg width="16" height="16" viewBox="0 0 24 24">
        <path fill={active ? "#34d399" : "rgba(255,255,255,0.3)"} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.01 14.93A7.987 7.987 0 0 1 12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8c2.15 0 4.1.86 5.53 2.24l-2.31 2.31A4.974 4.974 0 0 0 12 8c-2.76 0-5 2.24-5 5s2.24 5 5 5c2.1 0 3.89-1.3 4.64-3.14H12v-3h8.01c.1.58.16 1.18.16 1.82 0 1.86-.51 3.61-1.4 5.11l.24.14z"/>
      </svg>
    ),
  },
];

const SUGGESTIONS_EMPTY_BY_LANG: Record<string, string[]> = {
  en: ["Write 3 hooks for my best market", "What's killing my ROAS right now?", "Generate a UGC script for my top audience", "Which ad format should I test next?"],
  pt: ["Escreva 3 hooks para meu melhor mercado", "O que está matando meu ROAS agora?", "Gere um roteiro UGC para meu público principal", "Qual formato de anúncio devo testar a seguir?"],
  es: ["Escribe 3 hooks para mi mejor mercado", "¿Qué está matando mi ROAS ahora?", "Genera un guión UGC para mi audiencia principal", "¿Qué formato de anuncio debo probar a continuación?"],
  fr: ["Écris 3 hooks pour mon meilleur marché", "Qu'est-ce qui tue mon ROAS en ce moment?", "Génère un script UGC pour mon audience principale", "Quel format publicitaire tester ensuite?"],
  de: ["Schreib 3 Hooks für meinen besten Markt", "Was tötet gerade meinen ROAS?", "Erstelle ein UGC-Skript für mein Hauptpublikum", "Welches Anzeigenformat soll ich als nächstes testen?"],
  zh: ["为我最好的市场写3个钩子", "什么在杀死我的ROAS？", "为我的主要受众生成UGC脚本", "我下一步应该测试哪种广告格式？"],
  ar: ["اكتب 3 hooks لأفضل سوق لديّ", "ما الذي يقتل ROAS الخاص بي الآن؟", "أنشئ سكريبت UGC لجمهوري الرئيسي", "ما تنسيق الإعلان الذي يجب اختباره بعد ذلك؟"],
};

const SUGGESTIONS_WITH_DATA_BY_LANG = (pulse: AccountPulse, lang: string): string[] => {
  const score = pulse.avgHookScore?.toFixed(1) ?? "—";
  const market = pulse.topMarket ?? "top";
  const maps: Record<string, string[]> = {
    en: [`What's killing my ROAS this week?`, `Write 3 hooks for my ${market} market`, "Which of my ads should I pause now?", "What should I produce next?"],
    pt: [`O que está matando meu ROAS essa semana?`, `Escreva 3 hooks para o mercado ${market}`, "Qual anúncio devo pausar agora?", "O que produzir a seguir?"],
    es: [`¿Qué está matando mi ROAS esta semana?`, `Escribe 3 hooks para el mercado ${market}`, "¿Qué anuncio debo pausar ahora?", "¿Qué producir a continuación?"],
    fr: [`Qu'est-ce qui tue mon ROAS cette semaine?`, `Écris 3 hooks pour le marché ${market}`, "Quelle pub dois-je mettre en pause maintenant?", "Que produire ensuite?"],
    de: [`Was tötet meinen ROAS diese Woche?`, `Schreib 3 Hooks für den ${market}-Markt`, "Welche Anzeige soll ich jetzt pausieren?", "Was als nächstes produzieren?"],
    zh: [`什么在这周杀死我的ROAS？`, `为${market}市场写3个钩子`, "我现在应该暂停哪个广告？", "接下来应该制作什么？"],
    ar: [`ما الذي يقتل ROAS هذا الأسبوع؟`, `اكتب 3 hooks لسوق ${market}`, "أي إعلان يجب إيقافه الآن؟", "ماذا أنتج بعد ذلك؟"],
  };
  return maps[lang] || maps["en"];
};

const TOOLS_BY_LANG: Record<string, Array<{icon: any; label: string; action: string; color: string}>> = {
  en: [{ icon: Upload, label: "Upload ad", action: "upload", color: BLUE }, { icon: Zap, label: "Generate hooks", action: "hooks", color: TEAL }, { icon: FileText, label: "Write script", action: "script", color: GREEN }, { icon: BarChart3, label: "Competitor", action: "competitor", color: PURPLE }],
  pt: [{ icon: Upload, label: "Upload de anúncio", action: "upload", color: BLUE }, { icon: Zap, label: "Gerar hooks", action: "hooks", color: TEAL }, { icon: FileText, label: "Escrever roteiro", action: "script", color: GREEN }, { icon: BarChart3, label: "Concorrente", action: "competitor", color: PURPLE }],
  es: [{ icon: Upload, label: "Subir anuncio", action: "upload", color: BLUE }, { icon: Zap, label: "Generar hooks", action: "hooks", color: TEAL }, { icon: FileText, label: "Escribir guión", action: "script", color: GREEN }, { icon: BarChart3, label: "Competidor", action: "competitor", color: PURPLE }],
  fr: [{ icon: Upload, label: "Charger annonce", action: "upload", color: BLUE }, { icon: Zap, label: "Générer hooks", action: "hooks", color: TEAL }, { icon: FileText, label: "Écrire script", action: "script", color: GREEN }, { icon: BarChart3, label: "Concurrent", action: "competitor", color: PURPLE }],
  de: [{ icon: Upload, label: "Anzeige hochladen", action: "upload", color: BLUE }, { icon: Zap, label: "Hooks erstellen", action: "hooks", color: TEAL }, { icon: FileText, label: "Skript schreiben", action: "script", color: GREEN }, { icon: BarChart3, label: "Konkurrent", action: "competitor", color: PURPLE }],
  zh: [{ icon: Upload, label: "上传广告", action: "upload", color: BLUE }, { icon: Zap, label: "生成钩子", action: "hooks", color: TEAL }, { icon: FileText, label: "写脚本", action: "script", color: GREEN }, { icon: BarChart3, label: "竞争对手", action: "competitor", color: PURPLE }],
  ar: [{ icon: Upload, label: "رفع إعلان", action: "upload", color: BLUE }, { icon: Zap, label: "إنشاء hooks", action: "hooks", color: TEAL }, { icon: FileText, label: "كتابة سكريبت", action: "script", color: GREEN }, { icon: BarChart3, label: "منافس", action: "competitor", color: PURPLE }],
};

// ── AI Block ──────────────────────────────────────────────────────────────────
function Block({ block, onNav }: { block: AIBlock; onNav: (r: string) => void }) {
  const color = BLOCK_COLORS[block.type] || GREEN;

  // Tool result — shows output from an executed tool inline
  if (block.type === "tool_result") {
    const toolIcons: Record<string, string> = {
      hooks: "⚡", script: "✍️", brief: "📋", competitor: "🔍", translate: "🌍", preflight: "🛫",
    };
    const icon = toolIcons[block.tool_name || ""] || null;
    return (
      <div style={{ borderRadius: 14, border: `1px solid ${GREEN}25`, background: `linear-gradient(135deg, ${GREEN}06 0%, rgba(13,15,24,0.95) 100%)`, overflow: "hidden", marginBottom: 8 }}>
        {/* Tool result header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${GREEN}15` }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: GREEN }}>{block.title}</span>
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: `${GREEN}15`, color: GREEN, fontFamily: F, fontWeight: 600, marginLeft: "auto" }}>GENERATED</span>
        </div>
        {/* Content */}
        <div style={{ padding: "12px 14px" }}>
          {block.result_content && (
            <p style={{ fontFamily: F, fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.75, whiteSpace: "pre-line", marginBottom: block.result_items?.length ? 12 : 0 }}>{block.result_content}</p>
          )}
          {block.result_items?.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: GREEN, fontSize: 13, fontWeight: 700, flexShrink: 0, minWidth: 20, fontFamily: F }}>{i + 1}.</span>
              <p style={{ fontFamily: F, fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.7, margin: 0 }}>{item}</p>
            </div>
          ))}
          {/* Copy all button */}
          {(block.result_items || block.result_content) && (
            <button
              onClick={() => {
                const text = block.result_items ? block.result_items.join("\n\n") : (block.result_content || "");
                navigator.clipboard.writeText(text);
              }}
              style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: F, cursor: "pointer" }}
            >
              📋 Copy all
            </button>
          )}
        </div>
      </div>
    );
  }

  if (block.type === "navigate") {
    return (
      <div style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)", marginBottom: 8 }}>
        <p style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: BLUE, marginBottom: 6 }}>{block.title}</p>
        {block.content && <p style={{ fontFamily: F, fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, marginBottom: 12 }}>{block.content}</p>}
        <button onClick={() => onNav(block.route!)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: `linear-gradient(135deg,${BLUE},${TEAL})`, color: "#000", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", fontFamily: F }}>
          {block.cta || "Open →"} <ArrowRight size={13} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      {block.title && <p style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color, marginBottom: 6 }}>{block.title}</p>}
      {block.content && <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.88)", lineHeight: 1.75, marginBottom: block.items ? 10 : 0 }}>{block.content}</p>}
      {block.items?.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6, alignItems: "flex-start" }}>
          <span style={{ color, fontSize: 16, flexShrink: 0, lineHeight: 1.5 }}>·</span>
          <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>{item}</p>
        </div>
      ))}
    </div>
  );
}

// ── Platform connection badge — with real logo ────────────────────────────────
function PlatformBadge({ platform, connected, onConnect, onDisconnect, requiresPersona, dt }: {
  platform: typeof PLATFORMS[0];
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  requiresPersona: boolean;
  dt: (key: string) => string;
}) {
  const [hov, setHov] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon = platform.icon;

  if (connected) {
    return (
      <div style={{ position: "relative" }}>
        <button
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => { setHov(false); }}
          onClick={() => setMenuOpen(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "7px 12px", borderRadius: 9,
            background: hov ? `${platform.activeColor}18` : `${platform.activeColor}10`,
            border: `1px solid ${platform.activeColor}35`,
            cursor: "pointer", transition: "all 0.15s", fontFamily: F,
          }}
        >
          <Icon active={true} />
          <span style={{ fontSize: 12, fontWeight: 500, color: platform.activeColor }}>{platform.label}</span>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, animation: "statusPulse 2.5s infinite", flexShrink: 0 }} />
        </button>
        {menuOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100, background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
              <div style={{ padding: "8px 12px 6px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <p style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: platform.activeColor }}>{platform.label}</p>
                <p style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{dt("loop_connected")}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); onDisconnect(); }}
                style={{ width: "100%", padding: "9px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: F, fontSize: 12, color: "#f87171", display: "flex", alignItems: "center", gap: 7, transition: "background 0.1s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.08)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 13 }}>✕</span> {dt("loop_disconnect")}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Coming soon: TikTok and Google not yet available
  if (platform.id === "tiktok" || platform.id === "google") {
    return (
      <div style={{ position: "relative" }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "7px 12px", borderRadius: 9,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            cursor: "default", opacity: 0.4, fontFamily: F,
          }}
        >
          <Icon active={false} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.35)" }}>{platform.label}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{dt("loop_soon")}</span>
        </div>
      </div>
    );
  }

  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onConnect}
      title={requiresPersona ? dt("loop_select_persona") : `Connect ${platform.label}`}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "7px 12px", borderRadius: 9,
        background: hov && !requiresPersona ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${hov && !requiresPersona ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`,
        cursor: requiresPersona ? "not-allowed" : "pointer",
        transition: "all 0.15s", opacity: requiresPersona ? 0.45 : 1, fontFamily: F,
      }}
    >
      <Icon active={false} />
      <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>{platform.label}</span>
    </button>
  );
}

// ── Inline Tool Panel ─────────────────────────────────────────────────────────
function InlineToolPanel({ action, prefill, onClose, onSend, language, dt }: {
  action: string;
  prefill: string;
  onClose: () => void;
  onSend: (msg: string) => void;
  language: string;
  dt: (k: any) => string;
}) {
  const [val, setVal] = useState(prefill);
  const [platform, setPlatform] = useState("meta");
  const [tone, setTone] = useState("direct");

  const config: Record<string, {
    icon: string; color: string;
    title: Record<string, string>;
    placeholder: Record<string, string>;
    cta: Record<string, string>;
    buildMsg: (v: string, p: string, t: string) => string;
  }> = {
    hooks: {
      icon: "⚡", color: "#06b6d4",
      title: { en: "Generate Hooks", pt: "Gerar Hooks", es: "Generar Hooks" },
      placeholder: { en: "Describe your product, angle, or paste context from the conversation…", pt: "Descreva seu produto, ângulo, ou cole o contexto da conversa…", es: "Describe tu producto, ángulo, o pega el contexto de la conversación…" },
      cta: { en: "Generate 5 hooks →", pt: "Gerar 5 hooks →", es: "Generar 5 hooks →" },
      buildMsg: (v, p, t) => `Generate 5 high-converting ${t} ad hooks for ${p} based on this context: "${v}". Format each as: [Hook number]. [Hook text]. Include hook type label.`,
    },
    script: {
      icon: "✍️", color: "#34d399",
      title: { en: "Write Script", pt: "Escrever Roteiro", es: "Escribir Guión" },
      placeholder: { en: "What's the ad about? Paste context or describe the brief…", pt: "Sobre o que é o anúncio? Cole o contexto ou descreva o brief…", es: "¿De qué trata el anuncio? Pega el contexto o describe el brief…" },
      cta: { en: "Write script →", pt: "Escrever roteiro →", es: "Escribir guión →" },
      buildMsg: (v, p, t) => `Write a complete ${t} video ad script for ${p}. Brief: "${v}". Format: VO (voiceover), ON-SCREEN TEXT, VISUAL NOTE for each scene. Include a strong hook in the first 3 seconds.`,
    },
    competitor: {
      icon: "🔍", color: "#a78bfa",
      title: { en: "Competitor Analysis", pt: "Análise de Concorrente", es: "Análisis de Competidor" },
      placeholder: { en: "Paste a competitor ad URL, describe their creative, or enter their brand name…", pt: "Cole uma URL de anúncio concorrente, descreva o criativo ou escreva o nome da marca…", es: "Pega una URL de anuncio competidor, describe su creativo o escribe el nombre de la marca…" },
      cta: { en: "Analyze →", pt: "Analisar →", es: "Analizar →" },
      buildMsg: (v, _p, _t) => `Analyze this competitor's ad creative and give me: 1) Hook type and formula, 2) Emotional trigger used, 3) Creative model (UGC/demo/testimonial/etc), 4) What makes it work, 5) How I can beat it with a stronger angle. Competitor info: "${v}"`,
    },
  };

  const cfg = config[action];
  if (!cfg) return null;

  const lang = ["en","pt","es"].includes(language) ? language : "en";
  const platforms = ["meta", "tiktok", "google"];
  const tones: Record<string, Record<string, string>> = {
    direct:       { en: "Direct", pt: "Direto", es: "Directo" },
    conversational: { en: "Conversational", pt: "Conversacional", es: "Conversacional" },
    urgent:       { en: "Urgent", pt: "Urgente", es: "Urgente" },
    educational:  { en: "Educational", pt: "Educativo", es: "Educativo" },
  };

  const handleSubmit = () => {
    if (!val.trim()) return;
    onSend(cfg.buildMsg(val.trim(), platform, tone));
    onClose();
  };

  return (
    <div style={{
      borderRadius: 16, overflow: "hidden",
      border: `1px solid ${cfg.color}25`,
      background: `linear-gradient(135deg, ${cfg.color}08 0%, rgba(13,15,24,0.95) 100%)`,
      boxShadow: `0 8px 40px ${cfg.color}10`,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      animation: "toolSlideIn 0.25s ease",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: `1px solid ${cfg.color}15` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{cfg.icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{cfg.title[lang]}</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16, padding: 4, lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Platform + Tone pills — only for hooks/script */}
        {action !== "competitor" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {platforms.map(p => (
                <button key={p} onClick={() => setPlatform(p)}
                  style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: platform === p ? cfg.color : "rgba(255,255,255,0.06)", color: platform === p ? "#000" : "rgba(255,255,255,0.4)", transition: "all 0.12s" }}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.08)" }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {Object.entries(tones).map(([k, v]) => (
                <button key={k} onClick={() => setTone(k)}
                  style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: tone === k ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", color: tone === k ? "#fff" : "rgba(255,255,255,0.35)", transition: "all 0.12s" }}>
                  {v[lang]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Text area */}
        <textarea
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder={cfg.placeholder[lang]}
          rows={3}
          autoFocus
          style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, lineHeight: 1.6, resize: "none", outline: "none", fontFamily: "inherit", caretColor: cfg.color, boxSizing: "border-box" }}
          onFocus={e => { (e.currentTarget).style.borderColor = `${cfg.color}50`; }}
          onBlur={e => { (e.currentTarget).style.borderColor = "rgba(255,255,255,0.1)"; }}
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleSubmit(); }}
        />

        {/* Submit */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>⌘↵</span>
          <button onClick={handleSubmit} disabled={!val.trim()}
            style={{ padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: val.trim() ? `linear-gradient(135deg, ${cfg.color}, ${cfg.color}bb)` : "rgba(255,255,255,0.06)", color: val.trim() ? "#000" : "rgba(255,255,255,0.25)", border: "none", cursor: val.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "all 0.15s" }}>
            {cfg.cta[lang]}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Suggestion Bubble ─────────────────────────────────────────────────────────
function SuggestionBubble({ suggestions, onSend, hasData, dt }: {
  suggestions: string[];
  onSend: (s: string) => void;
  hasData: boolean;
  dt: (k: any) => string;
}) {
  const iconColors = [BLUE, TEAL, GREEN, PURPLE];
  const iconComponents = [BarChart3, Zap, FileText, Target];
  return (
    <div style={{ width: "100%", maxWidth: 660, animation: "chatMsgIn 0.4s cubic-bezier(0.16,1,0.3,1) both" }}>
      {/* Welcome hero */}
      <div style={{ textAlign: "center", marginBottom: 28, padding: "12px 0 0" }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 14px", boxShadow: "0 4px 24px rgba(14,165,233,0.25)",
        }}>
          <Sparkles size={20} color="#fff" strokeWidth={2} />
        </div>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
          {hasData ? "Ready to work." : "AdBrief AI"}
        </h2>
        <p style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.5 }}>
          {hasData ? "Your account data is loaded. What should we optimize?" : "Ask about your campaigns, generate hooks, or analyze competitors."}
        </p>
      </div>

      {/* Suggestion cards */}
      <div className="suggestions-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {suggestions.slice(0, 4).map((s, i) => {
          const Icon = iconComponents[i];
          const color = iconColors[i];
          return (
            <button key={i} onClick={() => onSend(s)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                borderRadius: 12, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer", textAlign: "left", fontFamily: F,
                transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                animation: `chatMsgIn 0.35s ${0.08 + i * 0.06}s cubic-bezier(0.16,1,0.3,1) both`,
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${color}0c`; el.style.borderColor = `${color}25`; el.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.03)"; el.style.borderColor = "rgba(255,255,255,0.06)"; el.style.transform = "translateY(0)"; }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={14} color={color} strokeWidth={2} />
              </div>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, fontWeight: 500 }}>{s}</span>
            </button>
          );
        })}
      </div>
      <style>{`
        @keyframes toolSlideIn { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}


export default function LoopV2() {
  const { user, selectedPersona, profile } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const dt = useDashT(language);
  const [feedback, setFeedback] = useState<Record<number, 'like' | 'dislike' | null>>({});
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [userPrefs, setUserPrefs] = useState<{ liked: string[]; disliked: string[] }>({ liked: [], disliked: [] });
  const navigate = useNavigate();

  const [pulse, setPulse] = useState<AccountPulse | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showUpgradeWall, setShowUpgradeWall] = useState(false);
  const [upgradeWallTrigger, setUpgradeWallTrigger] = useState<"chat" | "tool">("chat");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolInput, setToolInput] = useState<Record<string, string>>({});
  const [chatCount, setChatCount] = useState(() => {
    // localStorage persists across sessions — user can't bypass by reopening browser
    return parseInt(localStorage.getItem("adbrief_chat_count") || "0", 10);
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasData = (pulse?.totalAnalyses ?? 0) > 0;
  const suggestions = hasData && pulse ? SUGGESTIONS_WITH_DATA_BY_LANG(pulse, language) : (SUGGESTIONS_EMPTY_BY_LANG[language] || SUGGESTIONS_EMPTY_BY_LANG["en"]);

  const loadPulse = useCallback(async () => {
    if (!user?.id) return null;
    try {
      const [{ data: analyses }, { data: imp }, { data: conns }] = await Promise.all([
        supabase.from("analyses").select("id, created_at, result, hook_strength, status, title")
          .eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(100),
        supabase.from("ads_data_imports" as never).select("platform, created_at" as never).eq("user_id" as never, user.id),
        supabase.from("platform_connections" as any).select("platform, status, ad_accounts").eq("user_id", user.id),
      ]);

      const rows = (analyses || []) as any[];
      const impRows = (imp || []) as any[];
      const connRows = (conns || []) as any[];

      const scores = rows.map((r: any) => (r.result as any)?.hook_score).filter(Boolean) as number[];
      const avg = scores.length ? scores.reduce((a, b) => a + b) / scores.length : null;

      const now = Date.now(), W = 7 * 86400000;
      const r7 = rows.filter((r: any) => +new Date(r.created_at) > now - W).map((r: any) => (r.result as any)?.hook_score).filter(Boolean) as number[];
      const p7 = rows.filter((r: any) => { const t = +new Date(r.created_at); return t > now - 2 * W && t <= now - W; }).map((r: any) => (r.result as any)?.hook_score).filter(Boolean) as number[];
      const delta = r7.length && p7.length ? Math.round((r7.reduce((a, b) => a + b) / r7.length - p7.reduce((a, b) => a + b) / p7.length) * 10) / 10 : null;

      const count = (f: string, arr: any[]) => { const m: Record<string, number> = {}; arr.forEach(r => { const v = r[f]; if (v && v !== "unknown") m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || null; };
      const markets: Record<string, number> = {}; rows.forEach((r: any) => { const m = (r.result as any)?.market; if (m) markets[m] = (markets[m] || 0) + 1; });
      const platMap: Record<string, number> = {}; impRows.forEach((r: any) => { const p = r.platform || "?"; if (p !== "other" && p !== "unknown") platMap[p] = (platMap[p] || 0) + 1; });

      const newPulse: AccountPulse = {
        avgHookScore: avg ? Math.round(avg * 10) / 10 : null,
        totalAnalyses: rows.length,
        viralHooks: rows.filter((r: any) => r.hook_strength === "viral").length,
        topFormat: count("hook_type", []),
        topMarket: Object.entries(markets).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
        weeklyDelta: delta,
        recentActivity: rows.slice(0, 5).map((r: any) => ({ title: r.title || "Analysis", score: (r.result as any)?.hook_score || null, ts: r.created_at })),
        platformImports: Object.entries(platMap).map(([platform, count]) => ({ platform, count })),
        connections: connRows,
      };
      setPulse(newPulse);
      return newPulse;
    } catch (e) { console.error(e); return null; }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => {
    loadPulse().then(p => {
      const connectedPlatforms = (p?.connections || []).filter(c => c.status === "active").map(c => c.platform);
      setMessages([{
        role: "assistant",
        blocks: [{
          type: p?.totalAnalyses ? "insight" : "action",
          title: "",
          content: p?.totalAnalyses
            ? (() => {
          const plats = connectedPlatforms.map(pl => pl.charAt(0).toUpperCase() + pl.slice(1)).join(" & ");
          const score = p.avgHookScore?.toFixed(1) ?? "—";
          const delta = p.weeklyDelta != null ? ` (${p.weeklyDelta > 0 ? "↑" : "↓"}${Math.abs(p.weeklyDelta)} vs semana anterior)` : "";
          const greetings: Record<string, string> = {
            en: `${plats ? plats + " connected. " : ""}${p.totalAnalyses} ${p.totalAnalyses === 1 ? "analysis" : "analyses"}, avg hook score ${score}/10${p.weeklyDelta != null ? ` (${p.weeklyDelta > 0 ? "↑" : "↓"}${Math.abs(p.weeklyDelta)} vs last week)` : ""}. What do you want to work on?`,
            pt: `${plats ? plats + " conectado. " : ""}${p.totalAnalyses} ${p.totalAnalyses === 1 ? "análise" : "análises"}, hook score médio ${score}/10${delta}. No que quer trabalhar?`,
            es: `${plats ? plats + " conectado. " : ""}${p.totalAnalyses} ${p.totalAnalyses === 1 ? "análisis" : "análisis"}, hook score promedio ${score}/10${p.weeklyDelta != null ? ` (${p.weeklyDelta > 0 ? "↑" : "↓"}${Math.abs(p.weeklyDelta)} vs semana pasada)` : ""}. ¿En qué quieres trabajar?`,
            fr: `${plats ? plats + " connecté. " : ""}${p.totalAnalyses} analyse${p.totalAnalyses !== 1 ? "s" : ""}, score hook moyen ${score}/10${p.weeklyDelta != null ? ` (${p.weeklyDelta > 0 ? "↑" : "↓"}${Math.abs(p.weeklyDelta)} vs semaine dernière)` : ""}. Sur quoi voulez-vous travailler?`,
            de: `${plats ? plats + " verbunden. " : ""}${p.totalAnalyses} Analyse${p.totalAnalyses !== 1 ? "n" : ""}, durchschn. Hook-Score ${score}/10${p.weeklyDelta != null ? ` (${p.weeklyDelta > 0 ? "↑" : "↓"}${Math.abs(p.weeklyDelta)} vs letzte Woche)` : ""}. Woran möchten Sie arbeiten?`,
            zh: `${plats ? plats + "已连接。" : ""}${p.totalAnalyses}个分析，平均钩子得分${score}/10${p.weeklyDelta != null ? `（${p.weeklyDelta > 0 ? "↑" : "↓"}${Math.abs(p.weeklyDelta)} vs上周）` : ""}。您想做什么？`,
            ar: `${plats ? plats + " متصل. " : ""}${p.totalAnalyses} تحليل، متوسط نقاط hook ${score}/10${p.weeklyDelta != null ? ` (${p.weeklyDelta > 0 ? "↑" : "↓"}${Math.abs(p.weeklyDelta)} مقارنة بالأسبوع الماضي)` : ""}. بماذا تريد العمل؟`,
          };
          return greetings[language] || greetings["en"];
        })()
            : (() => {
              const msgs: Record<string, string> = {
                en: "Connect your ad accounts and I'll analyze your campaigns in real time — or just ask me anything. Scripts, hooks, briefs, research, strategy.",
                pt: "Conecte suas contas de anúncios e analisarei suas campanhas em tempo real — ou pergunte qualquer coisa. Roteiros, hooks, briefs, pesquisa, estratégia.",
                es: "Conecta tus cuentas de anuncios y analizaré tus campañas en tiempo real — o pregunta lo que quieras. Guiones, hooks, briefs, investigación, estrategia.",
                fr: "Connectez vos comptes publicitaires et j'analyserai vos campagnes en temps réel — ou demandez ce que vous voulez. Scripts, hooks, briefs, recherche, stratégie.",
                de: "Verbinden Sie Ihre Anzeigenkonten und ich analysiere Ihre Kampagnen in Echtzeit — oder stellen Sie mir eine beliebige Frage.",
                zh: "连接您的广告账户，我将实时分析您的广告活动 — 或直接问我任何问题。脚本、钩子、简报、研究、策略。",
                ar: "اربط حسابات الإعلانات وسأحلل حملاتك في الوقت الفعلي — أو اسألني أي شيء. سكريبتات، هوكس، بريفات، بحث، استراتيجية.",
              };
              return msgs[language] || msgs["en"];
            })(),
        }],
        ts: Date.now(),
      }]);
      setReady(true);
    });
  }, [language]);

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel("loop_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "analyses", filter: `user_id=eq.${user.id}` },
        async () => {
          const newPulse = await loadPulse();
          if (newPulse) {
            setMessages(prev => [...prev, {
              role: "assistant" as const,
              blocks: [{ type: "insight" as const, title: "", content: `New analysis detected \u2014 ${newPulse.totalAnalyses} total${newPulse.avgHookScore ? `, avg ${newPulse.avgHookScore.toFixed(1)}/10` : ""}. Want me to review it?` }],
              ts: Date.now(),
            }]);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, loadPulse]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const buildRichContext = async (): Promise<string> => {
    try {
      const { data: analyses } = await supabase
        .from("analyses")
        .select("id, created_at, title, result, hook_strength, improvement_suggestions")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(10);

      const rows = (analyses || []) as any[];
      const scores = rows.map((r: any) => (r.result as any)?.hook_score).filter(Boolean) as number[];
      const avg = scores.length ? (scores.reduce((a: number, b: number) => a + b) / scores.length).toFixed(1) : "—";

      const hookMap: Record<string, { count: number; total: number }> = {};
      rows.forEach((r: any) => {
        const ht = (r.result as any)?.hook_type || r.hook_strength;
        if (!ht) return;
        if (!hookMap[ht]) hookMap[ht] = { count: 0, total: 0 };
        hookMap[ht].count++;
        hookMap[ht].total += (r.result as any)?.hook_score || 0;
      });
      const topHooks = Object.entries(hookMap)
        .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
        .slice(0, 3)
        .map(([t, d]) => `${t}(avg ${(d.total/d.count).toFixed(1)}, ${d.count}x)`);

      const recent = rows.slice(0, 5).map((a: any) => {
        const r = a.result as any;
        const imps = (r?.improvement_suggestions as string[] || a.improvement_suggestions || []).slice(0, 1).join("; ");
        return [
          `"${a.title || r?.market_guess || "untitled"}"`,
          `score:${r?.hook_score ?? "—"}`,
          `type:${r?.hook_type || a.hook_strength || "—"}`,
          `market:${r?.market_guess || "—"}`,
          `format:${r?.format || "—"}`,
          r?.summary ? `"${String(r.summary).slice(0, 60)}"` : "",
          imps ? `fix:"${imps}"` : "",
        ].filter(Boolean).join(" ");
      }).join("\n");

      // Fetch full persona data including result
      let personaCtx = "";
      if (selectedPersona) {
        try {
          const { data: pData } = await supabase.from("personas")
            .select("result").eq("id", selectedPersona.id).maybeSingle();
          if (pData) {
            const r = (pData.result as Record<string, any>) || {};
            personaCtx = [
              `ACTIVE PERSONA/CLIENT: ${r.name || "Unknown"}`,
              (selectedPersona as any).description ? `Description: ${(selectedPersona as any).description}` : (r.headline ? `Description: ${r.headline}` : ""),
              r.age ? `Age: ${r.age}` : "",
              r.preferred_market || r.market ? `Market: ${r.preferred_market || r.market}` : "",
              r.best_platforms?.length ? `Platforms: ${r.best_platforms.join(", ")}` : "",
              r.language_style ? `Language style: ${r.language_style}` : "",
              r.cta_style ? `CTA style: ${r.cta_style}` : "",
              r.pain_points?.length ? `Pain points: ${r.pain_points.slice(0, 3).join("; ")}` : "",
              r.interests?.length ? `Interests: ${r.interests.slice(0, 3).join(", ")}` : "",
              r.objections?.length ? `Objections: ${r.objections.slice(0, 2).join("; ")}` : "",
            ].filter(Boolean).join("\n");
          }
        } catch {}
      }
      const connectedStr = connectedPlatforms.length ? `CONNECTED: ${connectedPlatforms.join(", ")}` : "NO PLATFORMS CONNECTED";

      return [
        personaCtx,
        connectedStr,
        `STATS: ${rows.length} analyses | avg score ${avg}/10 | viral:${rows.filter((r: any) => r.hook_strength === "viral").length}`,
        topHooks.length ? `TOP HOOKS: ${topHooks.join(", ")}` : "",
        recent ? `RECENT ANALYSES:\n${recent}` : "",
        pulse?.topMarket ? `TOP MARKET: ${pulse.topMarket}` : "",
      ].filter(Boolean).join("\n");
    } catch (e) {
      return `STATS: ${pulse?.totalAnalyses || 0} analyses | avg ${pulse?.avgHookScore || "—"}/10`;
    }
  };

  const send = async (text: string) => {
    if (!text.trim() || sending) return;

    // ── Freemium gate ────────────────────────────────────────────────────────
    const userPlan = profile?.plan;

    if (isFree(userPlan)) {
      // Free: max 3 messages total — stored server-side per user, not in localStorage
      const FREE_LIMIT = 3;
      // Check Supabase for persistent count tied to user ID
      const { data: usageRow } = await (supabase as any)
        .from("free_usage")
        .select("chat_count")
        .eq("user_id", user.id)
        .maybeSingle();
      const serverCount = usageRow?.chat_count ?? 0;
      // Also check localStorage as fallback / sync
      const localCount = parseInt(localStorage.getItem(`adbrief_chat_count_${user.id}`) || "0", 10);
      const currentCount = Math.max(serverCount, localCount);
      if (currentCount >= FREE_LIMIT) {
        setUpgradeWallTrigger("chat");
        setShowUpgradeWall(true);
        return;
      }
      const newCount = currentCount + 1;
      // Update both server and local
      localStorage.setItem(`adbrief_chat_count_${user.id}`, String(newCount));
      setChatCount(newCount);
      // Soft upsell warning at message 2 of 3
      if (newCount === 2) {
        const warn: Record<string, string> = {
          en: "1 free message remaining. Upgrade to keep going →",
          pt: "1 mensagem gratuita restante. Faça upgrade para continuar →",
          es: "1 mensaje gratuito restante. Mejora tu plan para continuar →",
        };
        const warnText = warn[language] || warn.en;
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: "assistant" as const,
            blocks: [{ type: "action" as const, title: "", content: warnText, cta: language === "pt" ? "Ver planos" : language === "es" ? "Ver planes" : "See plans", route: "/pricing" }],
            ts: Date.now() + 100,
          }]);
        }, 800);
      }
      await (supabase as any)
        .from("free_usage")
        .upsert({ user_id: user.id, chat_count: newCount }, { onConflict: "user_id" });
    } else {
      // Paid plans: check daily limit
      const dailyLimit = chatDailyLimit(userPlan);
      if (dailyLimit !== null) {
        const today = new Date().toDateString();
        const key = `adbrief_chat_daily_${today}_${userPlan}`;
        const todayCount = parseInt(sessionStorage.getItem(key) || "0", 10);
        if (todayCount >= dailyLimit) {
          // Soft warning inline — no wall, just message in chat
          const planName = userPlan === "maker" ? "Maker" : userPlan === "pro" ? "Pro" : "Studio";
          const upgradeTarget = userPlan === "maker" ? "Pro (200/day)" : "Studio (unlimited)";
          setMessages(prev => [...prev, {
            role: "assistant" as const,
            blocks: [{ 
              type: "warning" as const, 
              title: dt("loop_daily_limit"),
              content: dt("loop_daily_limit_content").replace("{limit}", String(dailyLimit)).replace("{plan}", planName).replace("{upgrade}", upgradeTarget)
            }],
            ts: Date.now()
          }]);
          return;
        }
        sessionStorage.setItem(key, String(todayCount + 1));
      }
    }
    // ── End freemium gate ────────────────────────────────────────────────────

    setInput("");
    setSending(true);
    setMessages(prev => [
      ...prev,
      { role: "user", text, ts: Date.now() },
      { role: "assistant", loading: true, ts: Date.now() + 1 },
    ]);
    try {
      const richContext = await buildRichContext();
      // Build conversation history (last 6 exchanges = 12 messages)
      const history = messages
        .filter(m => !m.loading)
        .slice(-12)
        .map(m => ({
          role: m.role,
          content: m.role === "user"
            ? m.text || ""
            : (m.blocks || []).map((b: any) => [b.title, b.content, ...(b.items || [])].filter(Boolean).join(" ")).join(" "),
        }))
        .filter(m => m.content.trim());
      const { data, error } = await supabase.functions.invoke("adbrief-ai-chat", {
        body: { 
          message: text, 
          user_id: user.id, 
          persona_id: selectedPersona?.id, 
          context: richContext,
          history,
          user_language: language,
          user_prefs: userPrefs.liked.length || userPrefs.disliked.length ? {
            liked: userPrefs.liked.slice(-3),
            disliked: userPrefs.disliked.slice(-3),
          } : undefined,
        },
      });
      if (error) throw error;
      const aiBlocks: AIBlock[] = data?.blocks || [{ type: "insight" as const, title: "", content: data?.response || "✓" }];
      setMessages(prev => prev.map(m =>
        m.loading ? { role: "assistant" as const, blocks: aiBlocks, ts: Date.now() } : m
      ));

      // ── Auto-execute tool_call blocks ────────────────────────────────────
      for (const block of aiBlocks) {
        if (block.type !== "tool_call" || !block.tool) continue;

        const tool = block.tool;
        const params = block.tool_params || {};

        // Add "executing" loading message
        setMessages(prev => [...prev, { role: "assistant" as const, loading: true, ts: Date.now() + 10 }]);

        try {
          let resultBlocks: AIBlock[] = [];

          if (tool === "hooks") {
            const { data: hData } = await supabase.functions.invoke("generate-hooks", {
              body: {
                product: params.product || text,
                niche: params.niche || (selectedPersona as any)?.industry || "",
                market: params.market || (selectedPersona as any)?.preferred_market || "",
                platform: params.platform || "meta",
                tone: params.tone || "direct",
                user_id: user.id,
                persona_id: selectedPersona?.id,
              },
            });
            const hooks = hData?.hooks?.map((h: any) => h.hook_text || h.text || String(h)) || [];
            resultBlocks = [{ type: "tool_result", tool_name: "hooks", title: "⚡ Hooks generated from your account data", result_items: hooks }];
          }

          else if (tool === "script") {
            const { data: sData } = await supabase.functions.invoke("generate-script", {
              body: {
                product: params.product || text,
                offer: params.offer || "",
                market: params.market || (selectedPersona as any)?.preferred_market || "",
                platform: params.platform || "meta",
                angle: params.angle || "",
                user_id: user.id,
                persona_id: selectedPersona?.id,
              },
            });
            resultBlocks = [{ type: "tool_result", tool_name: "script", title: "✍️ Script generated", result_content: sData?.script || sData?.result || "" }];
          }

          else if (tool === "brief") {
            const { data: bData } = await supabase.functions.invoke("generate-brief", {
              body: {
                product: params.product || text,
                offer: params.offer || "",
                market: params.market || (selectedPersona as any)?.preferred_market || "",
                audience: params.audience || "",
                user_id: user.id,
                persona_id: selectedPersona?.id,
              },
            });
            resultBlocks = [{ type: "tool_result", tool_name: "brief", title: "📋 Brief generated", result_content: bData?.brief || bData?.result || "" }];
          }

          else if (tool === "competitor") {
            const { data: cData } = await supabase.functions.invoke("decode-competitor", {
              body: {
                ad_text: params.ad_text || params.url || text,
                industry: params.industry || "",
                market: params.market || "",
              },
            });
            const insights = cData?.insights || cData?.analysis || cData?.result || "";
            resultBlocks = [{ type: "tool_result", tool_name: "competitor", title: "🔍 Competitor decoded", result_content: typeof insights === "string" ? insights : JSON.stringify(insights) }];
          }

          else if (tool === "translate") {
            const { data: tData } = await supabase.functions.invoke("translate-text", {
              body: {
                text: params.text || text,
                target_language: params.target_language || "en",
                user_id: user.id,
              },
            });
            resultBlocks = [{ type: "tool_result", tool_name: "translate", title: "🌍 Translation", result_content: tData?.translated_text || tData?.result || "" }];
          }

          setMessages(prev => prev.map(m =>
            m.loading ? { role: "assistant" as const, blocks: resultBlocks, ts: Date.now() } : m
          ));
        } catch (toolErr: any) {
          setMessages(prev => prev.map(m =>
            m.loading ? { role: "assistant" as const, blocks: [{ type: "warning" as const, title: `Tool failed: ${tool}`, content: toolErr.message || "Try again" }], ts: Date.now() } : m
          ));
        }
      }
      // ── End tool execution ───────────────────────────────────────────────
    } catch (e: any) {
      setMessages(prev => prev.map(m =>
        m.loading ? { role: "assistant" as const, blocks: [{ type: "warning" as const, title: dt("loop_something_wrong"), content: e.message || dt("loop_try_again") }], ts: Date.now() } : m
      ));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const handleConnect = async (platform: typeof PLATFORMS[0]) => {
    if (!selectedPersona) {
      // Prompt persona selection instead
      setMessages(prev => [...prev, {
        role: "assistant" as const,
        blocks: [{ type: "warning" as const, title: dt("loop_select_persona"), content: dt("loop_select_persona_content").replace("{platform}", platform.label) }],
        ts: Date.now(),
      }]);
      return;
    }
    setConnecting(platform.id);
    try {
      const { data } = await supabase.functions.invoke(platform.fn, {
        body: { action: "get_auth_url", user_id: user.id, persona_id: selectedPersona.id },
      });
      if (data?.url) window.location.href = data.url;
    } catch (e) { console.error(e); }
    finally { setConnecting(null); }
  };

  const handleDisconnect = async (platformId: string) => {
    try {
      await supabase.from("platform_connections" as any)
        .delete()
        .eq("user_id", user.id)
        .eq("platform", platformId);
      // Refresh pulse
      await loadPulse();
      // Notify in chat
      setMessages(prev => [...prev, {
        role: "assistant" as const,
        blocks: [{ type: "action" as const, title: "", content: `${platformId.charAt(0).toUpperCase() + platformId.slice(1)} disconnected. You can reconnect anytime from the header.` }],
        ts: Date.now(),
      }]);
    } catch (e) { console.error(e); }
  };

  const handleToolAction = (action: string) => {
    if (isFree(profile?.plan)) {
      setUpgradeWallTrigger("tool");
      setShowUpgradeWall(true);
      return;
    }
    if (action === "upload") { navigate("/dashboard/analyses/new"); return; }
    // Pre-fill tool context from last AI response + persona
    const lastAI = [...messages].reverse().find(m => m.role === "assistant" && !m.loading);
    const lastAIText = lastAI?.blocks?.map((b: any) => b.content || "").join(" ").slice(0, 400) || "";
    const personaCtx = selectedPersona ? `${selectedPersona.name}${(selectedPersona as any).website ? " (" + (selectedPersona as any).website + ")" : ""}${(selectedPersona as any).description ? " — " + (selectedPersona as any).description : ""}` : "";
    setToolInput({
      hooks: lastAIText || personaCtx,
      script: lastAIText || personaCtx,
      competitor: "",
    });
    setActiveTool(prev => prev === action ? null : action);
  };

  const handleFeedback = async (msgIdx: number, type: 'like' | 'dislike', blocks: any[]) => {
    const prev = feedback[msgIdx];
    const newVal = prev === type ? null : type;
    setFeedback(f => ({ ...f, [msgIdx]: newVal }));
    // Extract text content from blocks for preference learning
    const responseText = blocks?.map((b: any) => b.content || '').join(' ').slice(0, 300);
    if (newVal === 'like') {
      setUserPrefs(p => ({ ...p, liked: [...p.liked.slice(-4), responseText] }));
    } else if (newVal === 'dislike') {
      setUserPrefs(p => ({ ...p, disliked: [...p.disliked.slice(-4), responseText] }));
    }
    // Persist to Supabase without extra API cost — just update a JSON column
    try {
      await (supabase as any).from('user_preferences').upsert(
        { user_id: user.id, liked_patterns: JSON.stringify(userPrefs.liked), disliked_patterns: JSON.stringify(userPrefs.disliked) },
        { onConflict: 'user_id' }
      );
    } catch (_) {}
  };

  const handleCopy = (msgIdx: number, blocks: any[]) => {
    const text = blocks?.map((b: any) => [b.title, b.content, ...(b.items || [])].filter(Boolean).join('\n')).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(msgIdx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser?.text) send(lastUser.text);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const connectedPlatforms = (pulse?.connections || []).filter(c => c.status === "active").map(c => c.platform);
  const hasConversation = messages.filter(m => m.role === "user").length > 0;

  return (
    <div className="loop-container" style={{ display: "flex", flexDirection: "column", height: "100%", background: "#090c14", fontFamily: F, overflow: "hidden", position: "relative", maxWidth: "100vw" }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0, gap: 12, position: "relative", zIndex: 2,
        background: "rgba(9,12,20,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      }}>
        {/* Left: persona */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          {selectedPersona ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                overflow: "hidden", boxShadow: "0 0 20px rgba(14,165,233,0.2)",
              }}>
                {(selectedPersona as any).logo_url
                  ? <img src={(selectedPersona as any).logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{selectedPersona.name?.charAt(0)?.toUpperCase() || "A"}</span>}
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", letterSpacing: "-0.01em" }}>{selectedPersona.name}</span>
                {hasData && (
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: 4 }}>
                    {pulse?.totalAnalyses} analyses
                    {pulse?.avgHookScore && <><span style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "inline-block" }} /> {pulse.avgHookScore.toFixed(1)}/10</>}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 20px rgba(14,165,233,0.15)",
              }}>
                <Sparkles size={16} color="#fff" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>AdBrief AI</span>
            </div>
          )}
        </div>

        {/* Right: platform badges */}
        <div className="hidden xl:flex" style={{ alignItems: "center", gap: 6, flexShrink: 0 }}>
          {PLATFORMS.map(p => (
            <PlatformBadge key={p.id} platform={p} connected={connectedPlatforms.includes(p.id)} onConnect={() => handleConnect(p)} onDisconnect={() => handleDisconnect(p.id)} requiresPersona={!selectedPersona} dt={dt} />
          ))}
          <button onClick={() => loadPulse()}
            style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginLeft: 2, transition: "all 0.2s" }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.04)"; }}>
            <RefreshCw size={13} color="rgba(255,255,255,0.4)" />
          </button>
        </div>
      </div>

      {/* ── Connect banner ── */}
      {connectedPlatforms.length === 0 && (
        <div style={{
          margin: "12px 20px 0", padding: "12px 16px", borderRadius: 12,
          background: "linear-gradient(135deg, rgba(14,165,233,0.08), rgba(6,182,212,0.04))",
          border: "1px solid rgba(14,165,233,0.15)",
          display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(14,165,233,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ExternalLink size={16} color={BLUE} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: F, margin: 0 }}>
              {language === "pt" ? "Conecte o Meta Ads para comecar" : language === "es" ? "Conecta Meta Ads para empezar" : "Connect Meta Ads to get started"}
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: F, margin: "2px 0 0" }}>
              {language === "pt" ? "A IA usa seus dados reais de campanha" : language === "es" ? "La IA usa tus datos reales" : "AI uses your real campaign data to respond"}
            </p>
          </div>
          <button onClick={() => navigate("/dashboard/persona")}
            style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 10, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", color: "#fff", fontWeight: 700, fontSize: 12, border: "none", cursor: "pointer", fontFamily: F, whiteSpace: "nowrap", boxShadow: "0 2px 12px rgba(14,165,233,0.3)", transition: "all 0.2s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(14,165,233,0.4)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(14,165,233,0.3)"; }}>
            {language === "pt" ? "Conectar" : language === "es" ? "Conectar" : "Connect"}
          </button>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="loop-messages" style={{ flex: 1, overflowY: "auto", minHeight: 0, position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "24px 20px 20px", display: "flex", flexDirection: "column", gap: 24 }}>

          {messages.map((msg, i) => (
            <div key={i} style={{ animation: "chatMsgIn 0.35s cubic-bezier(0.16,1,0.3,1) both" }}>
              {/* User bubble */}
              {msg.role === "user" && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{
                    maxWidth: "75%", padding: "12px 18px", borderRadius: "18px 18px 4px 18px",
                    background: "linear-gradient(135deg, #0ea5e9, #0891d2)",
                    boxShadow: "0 4px 16px rgba(14,165,233,0.2)",
                  }}>
                    <p style={{ fontSize: 14, color: "#fff", lineHeight: 1.7, fontFamily: F, margin: 0, letterSpacing: "-0.01em" }}>{msg.text}</p>
                  </div>
                </div>
              )}
              {/* AI bubble */}
              {msg.role === "assistant" && (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0, marginTop: 2,
                    background: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 12px rgba(14,165,233,0.2)",
                  }}>
                    {msg.loading
                      ? <Loader2 size={14} color="#fff" className="animate-spin" />
                      : <Sparkles size={14} color="#fff" strokeWidth={2} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Label */}
                    <p style={{ fontSize: 11, fontWeight: 700, color: BLUE, marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>ADBRIEF</p>
                    {msg.loading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 2 }}>
                        {[0,1,2].map(d => (
                          <div key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: BLUE, animation: `dotPulse 1.3s ease ${d*0.18}s infinite` }} />
                        ))}
                      </div>
                    ) : (
                      <>
                        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
                          {msg.blocks?.map((block, j) => <Block key={j} block={block} onNav={navigate} />)}
                        </div>
                        {/* Feedback bar */}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
                          <button onClick={() => handleFeedback(i, "like", msg.blocks || [])}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 28, borderRadius: 8, background: feedback[i] === "like" ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${feedback[i] === "like" ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", transition: "all 0.15s", fontSize: 12 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={feedback[i] === "like" ? GREEN : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                          </button>
                          <button onClick={() => handleFeedback(i, "dislike", msg.blocks || [])}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 28, borderRadius: 8, background: feedback[i] === "dislike" ? "rgba(248,113,113,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${feedback[i] === "dislike" ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", transition: "all 0.15s", fontSize: 12 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={feedback[i] === "dislike" ? RED : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
                          </button>
                          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.06)", margin: "0 2px" }} />
                          <button onClick={() => handleCopy(i, msg.blocks || [])}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px", height: 28, borderRadius: 8, background: copiedIdx === i ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${copiedIdx === i ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", color: copiedIdx === i ? GREEN : "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: F, fontWeight: 500, transition: "all 0.15s" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            {copiedIdx === i ? "Copied" : "Copy"}
                          </button>
                          {i === messages.length - 1 && (
                            <button onClick={handleRegenerate}
                              style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px", height: 28, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: F, fontWeight: 500, transition: "all 0.15s" }}
                              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.15)"; el.style.color = "rgba(255,255,255,0.6)"; }}
                              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.06)"; el.style.color = "rgba(255,255,255,0.35)"; }}>
                              <RefreshCw size={11} /> Retry
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Inline Tool Panel */}
          {activeTool && (
            <InlineToolPanel action={activeTool} prefill={toolInput[activeTool] || ""} onClose={() => setActiveTool(null)} onSend={(msg) => { setActiveTool(null); send(msg); }} language={language} dt={dt} />
          )}

          {!hasConversation && ready && (
            <SuggestionBubble suggestions={suggestions} onSend={send} hasData={hasData} dt={dt} />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Upgrade wall */}
      {showUpgradeWall && <UpgradeWall trigger={upgradeWallTrigger} onClose={() => setShowUpgradeWall(false)} />}

      {/* ── Input area ── */}
      <div className="loop-input-area" style={{
        padding: "0 20px 16px", flexShrink: 0,
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        position: "relative", zIndex: 2,
        background: "linear-gradient(180deg, transparent 0%, rgba(9,12,20,0.98) 30%)",
      }}>
        <div style={{ maxWidth: 740, margin: "0 auto", width: "100%" }}>

          {/* Input container — clean card */}
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18,
            overflow: "hidden",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
            onFocusCapture={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(14,165,233,0.4)"; el.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.08), 0 4px 24px rgba(0,0,0,0.2)"; }}
            onBlurCapture={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.08)"; el.style.boxShadow = "none"; }}>

            {/* Textarea row */}
            <div style={{ display: "flex", alignItems: "flex-end", padding: "14px 16px 10px", gap: 10 }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={selectedPersona ? `Ask about ${selectedPersona.name}...` : (dt("loop_placeholder") || "Ask anything about your campaigns...")}
                rows={1}
                autoFocus
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", color: "#fff", fontSize: 14, lineHeight: 1.7, maxHeight: 140, overflowY: "auto", fontFamily: F, caretColor: BLUE, letterSpacing: "-0.01em" }}
              />
              <button onClick={() => send(input)} disabled={!input.trim() || sending}
                style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: input.trim() && !sending ? "linear-gradient(135deg, #0ea5e9, #06b6d4)" : "rgba(255,255,255,0.06)",
                  border: "none", cursor: input.trim() && !sending ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
                  transform: input.trim() && !sending ? "scale(1)" : "scale(0.92)",
                  boxShadow: input.trim() && !sending ? "0 4px 16px rgba(14,165,233,0.3)" : "none",
                }}>
                {sending ? <Loader2 size={15} color="rgba(255,255,255,0.7)" className="animate-spin" /> : <Send size={15} color={input.trim() ? "#fff" : "rgba(255,255,255,0.2)"} />}
              </button>
            </div>

            {/* Tool pills row — inside input card */}
            <div className="loop-tool-pills" style={{
              display: "flex", alignItems: "center", gap: 4, padding: "0 14px 10px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
            }}>
              {(TOOLS_BY_LANG[language] || TOOLS_BY_LANG["en"]).map(t => (
                <button key={t.action} onClick={() => handleToolAction(t.action)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                    borderRadius: 8, background: "transparent",
                    border: "none", color: "rgba(255,255,255,0.35)", fontSize: 11,
                    fontWeight: 500, cursor: "pointer", fontFamily: F, transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = t.color; el.style.background = `${t.color}0a`; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(255,255,255,0.35)"; el.style.background = "transparent"; }}>
                  <t.icon size={12} strokeWidth={1.8} /> {t.label}
                </button>
              ))}
              <span className="hidden lg:inline" style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", marginLeft: "auto", fontFamily: F }}>
                Enter
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes statusPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes dotPulse { 0%,80%,100%{opacity:0.2;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }
        @keyframes chatMsgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseDotChat { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 99px; }
        textarea::placeholder { color: rgba(255,255,255,0.25); }
        .loop-container { height: calc(100dvh - 44px); display: flex; flex-direction: column; overflow: hidden; }
        .loop-messages { flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        .loop-input-area { flex-shrink: 0; position: relative; z-index: 10; }
        @media (max-width: 1023px) {
          .dashboard-main { overflow-y: auto !important; overflow-x: hidden !important; -webkit-overflow-scrolling: touch; }
          .loop-container { height: auto !important; min-height: calc(100dvh - 100px); overflow: visible !important; display: flex !important; flex-direction: column !important; }
          .loop-messages { flex: 1 !important; overflow-y: auto !important; overflow-x: hidden !important; -webkit-overflow-scrolling: touch; }
          .loop-input-area { position: sticky !important; bottom: 0 !important; z-index: 20 !important; background: #090c14 !important; padding-bottom: max(12px, env(safe-area-inset-bottom)) !important; }
          .loop-tool-pills { display: none !important; }
          .suggestions-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .loop-header-badges { display: none !important; }
          .loop-input-area textarea { font-size: 16px !important; }
          body, .dashboard-root { overflow-x: hidden !important; }
        }
      `}</style>
    </div>
  );
}
