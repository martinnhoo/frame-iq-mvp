import { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import UpgradeWall from "@/components/UpgradeWall";
import { isFree, chatDailyLimit } from "@/lib/planLimits";
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
  type: "insight" | "action" | "warning" | "pattern" | "hooks" | "navigate" | "data";
  title: string; content?: string; items?: string[];
  route?: string; cta?: string; data?: Record<string, string>;
}
interface AIMessage {
  role: "user" | "assistant";
  text?: string; blocks?: AIBlock[]; ts: number; loading?: boolean;
}

const BLOCK_COLORS: Record<AIBlock["type"], string> = {
  insight: GREEN, action: BLUE, warning: AMBER,
  pattern: PURPLE, hooks: TEAL, navigate: BLUE, data: "rgba(255,255,255,0.5)",
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
  const color = BLOCK_COLORS[block.type];

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
      {block.content && <p style={{ fontFamily: F, fontSize: 15, color: "rgba(255,255,255,0.82)", lineHeight: 1.75, marginBottom: block.items ? 10 : 0 }}>{block.content}</p>}
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
function PlatformBadge({ platform, connected, onConnect, onDisconnect, requiresPersona }: {
  platform: typeof PLATFORMS[0];
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  requiresPersona: boolean;
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
                <p style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Connected</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); onDisconnect(); }}
                style={{ width: "100%", padding: "9px 12px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: F, fontSize: 12, color: "#f87171", display: "flex", alignItems: "center", gap: 7, transition: "background 0.1s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.08)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 13 }}>✕</span> Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onConnect}
      title={requiresPersona ? "Select a persona first to connect" : `Connect ${platform.label}`}
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LoopV2() {
  const { user, selectedPersona, profile } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
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
  const [chatCount, setChatCount] = useState(() => {
    // Load from sessionStorage — resets each browser session (not persistent)
    return parseInt(sessionStorage.getItem("adbrief_chat_count") || "0", 10);
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasData = (pulse?.totalAnalyses ?? 0) > 0;
  const suggestions = hasData && pulse ? SUGGESTIONS_WITH_DATA_BY_LANG(pulse, language) : (SUGGESTIONS_EMPTY_BY_LANG[language] || SUGGESTIONS_EMPTY_BY_LANG["en"]);

  const loadPulse = useCallback(async () => {
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
  }, [user.id]);

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
            : "Connect your ad accounts and I'll analyze your campaigns in real time — or just ask me anything. Scripts, hooks, briefs, research, strategy.",
        }],
        ts: Date.now(),
      }]);
      setReady(true);
    });
  }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel("loop_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "analyses", filter: `user_id=eq.${user.id}` },
        async () => {
          const newPulse = await loadPulse();
          if (newPulse) {
            setMessages(prev => [...prev, {
              role: "assistant" as const,
              blocks: [{ type: "insight" as const, title: "", content: `New analysis detected — ${newPulse.totalAnalyses} total${newPulse.avgHookScore ? `, avg ${newPulse.avgHookScore.toFixed(1)}/10` : ""}. Want me to review it?` }],
              ts: Date.now(),
            }]);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user.id, loadPulse]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
              r.headline ? `Description: ${r.headline}` : "",
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
      // Free: max 3 messages total per session
      const FREE_LIMIT = 3;
      const currentCount = parseInt(sessionStorage.getItem("adbrief_chat_count") || "0", 10);
      if (currentCount >= FREE_LIMIT) {
        setUpgradeWallTrigger("chat");
        setShowUpgradeWall(true);
        return;
      }
      const newCount = currentCount + 1;
      sessionStorage.setItem("adbrief_chat_count", String(newCount));
      setChatCount(newCount);
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
              title: `Daily limit reached — ${dailyLimit} messages used`,
              content: `You've used all ${dailyLimit} messages for today on the ${planName} plan. Your limit resets tomorrow. Upgrade to ${upgradeTarget} for more.`
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
        },
      });
      if (error) throw error;
      setMessages(prev => prev.map(m =>
        m.loading ? { role: "assistant" as const, blocks: data?.blocks || [{ type: "insight" as const, title: "", content: data?.response || "Done." }], ts: Date.now() } : m
      ));
    } catch (e: any) {
      setMessages(prev => prev.map(m =>
        m.loading ? { role: "assistant" as const, blocks: [{ type: "warning" as const, title: "Something went wrong", content: e.message || "Try again." }], ts: Date.now() } : m
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
        blocks: [{ type: "warning" as const, title: "Select a persona first", content: `To connect ${platform.label}, select a persona (workspace) from the top bar. Each persona represents a client or brand — this keeps your ad accounts organized.` }],
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
    // Block tool actions for free users
    if (isFree(profile?.plan)) {
      setUpgradeWallTrigger("tool");
      setShowUpgradeWall(true);
      return;
    }
    const routes: Record<string, string> = {
      upload: "/dashboard/analyses/new",
      hooks: "/dashboard/hooks",
      script: "/dashboard/script",
      competitor: "/dashboard/competitor",
    };
    if (routes[action]) navigate(routes[action]);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const connectedPlatforms = (pulse?.connections || []).filter(c => c.status === "active").map(c => c.platform);
  const hasConversation = messages.filter(m => m.role === "user").length > 0;

  return (
    <div className="loop-container" style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, background: "#0a0a0a", fontFamily: F, overflow: "hidden" }}>

      {/* ── Header — clean, just platform status ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", height: 48, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, gap: 8 }}>

        {/* Left: persona + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          {selectedPersona ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{selectedPersona.avatar_emoji}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedPersona.name}</span>
              {hasData && (
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.1)", display: "inline-block" }} />
                  {pulse?.totalAnalyses}
                  {pulse?.avgHookScore && <span style={{ color: "rgba(255,255,255,0.45)" }}> · {pulse.avgHookScore.toFixed(1)}/10</span>}
                </span>
              )}
            </div>
          ) : (
            connectedPlatforms.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {connectedPlatforms.map(p => (
                  <span key={p} style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.06)", padding: "3px 8px", borderRadius: 6 }}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>AdBrief AI</span>
            )
          )}
        </div>

        {/* Right: platform badges — hidden on mobile, visible on desktop */}
        <div className="hidden lg:flex" style={{ alignItems: "center", gap: 6, display: "flex" }}>
          {PLATFORMS.map(p => (
            <PlatformBadge
              key={p.id}
              platform={p}
              connected={connectedPlatforms.includes(p.id)}
              onConnect={() => handleConnect(p)}
              onDisconnect={() => handleDisconnect(p.id)}
              requiresPersona={!selectedPersona}
            />
          ))}
          <button onClick={() => loadPulse()}
            style={{ width: 30, height: 30, borderRadius: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginLeft: 4 }}>
            <RefreshCw size={12} color="rgba(255,255,255,0.25)" />
          </button>
        </div>

      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "20px 16px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: "76%", padding: "11px 16px", borderRadius: "16px 16px 4px 16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }}>
                    <p style={{ fontSize: 15, color: "rgba(255,255,255,0.9)", lineHeight: 1.65, fontFamily: F }}>{msg.text}</p>
                  </div>
                </div>
              )}
              {msg.role === "assistant" && (
                <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    {msg.loading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
                        <Loader2 size={14} color="rgba(255,255,255,0.3)" className="animate-spin" />
                        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontFamily: F }}>Thinking...</span>
                      </div>
                    ) : (
                      msg.blocks?.map((block, j) => <Block key={j} block={block} onNav={navigate} />)
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {!hasConversation && ready && (
            <div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginBottom: 14, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {hasData ? (language === "pt" ? "Baseado na sua conta" : language === "es" ? "Basado en tu cuenta" : "Based on your account") : (language === "pt" ? "Sugestões" : language === "es" ? "Sugerencias" : "Suggestions")}
              </p>
              <div className="suggestions-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => send(s)}
                    style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(14,165,233,0.04)", border: "1px solid rgba(14,165,233,0.15)", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", textAlign: "left", lineHeight: 1.5, fontFamily: F, transition: "all 0.15s", minHeight: 56, display: "flex", alignItems: "center", fontWeight: 500 }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(14,165,233,0.4)"; el.style.color = "#fff"; el.style.background = "rgba(14,165,233,0.1)"; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(14,165,233,0.15)"; el.style.color = "rgba(255,255,255,0.7)"; el.style.background = "rgba(14,165,233,0.04)"; }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Upgrade wall */}
      {showUpgradeWall && (
        <UpgradeWall
          trigger={upgradeWallTrigger}
          onClose={() => setShowUpgradeWall(false)}
        />
      )}

      {/* ── Input ── */}
      <div style={{ padding: "10px 16px 12px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div style={{ maxWidth: 740, margin: "0 auto", width: "100%" }}>
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-end", transition: "border-color 0.15s" }}
            onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(14,165,233,0.4)"; }}
            onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={selectedPersona ? `Ask anything about ${selectedPersona.name}...` : "Ask anything about your campaigns, ads, or strategy..."}
              rows={1}
              autoFocus
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", color: "#fff", fontSize: 15, lineHeight: 1.65, maxHeight: 120, overflowY: "auto", fontFamily: F, caretColor: BLUE }}
            />
            <button onClick={() => send(input)} disabled={!input.trim() || sending}
              style={{ width: 34, height: 34, borderRadius: 9, background: input.trim() && !sending ? `linear-gradient(135deg,${BLUE},${TEAL})` : "rgba(255,255,255,0.06)", border: "none", cursor: input.trim() && !sending ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.12s" }}>
              {sending ? <Loader2 size={14} color="rgba(255,255,255,0.4)" className="animate-spin" /> : <Send size={14} color={input.trim() ? "#000" : "rgba(255,255,255,0.25)"} />}
            </button>
          </div>

          {/* Tool actions — only non-connect tools */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {(TOOLS_BY_LANG[language] || TOOLS_BY_LANG["en"]).map(t => (
              <button key={t.action} onClick={() => handleToolAction(t.action)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer", fontFamily: F, transition: "all 0.1s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${t.color}40`; el.style.color = t.color; el.style.background = `${t.color}0a`; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "rgba(255,255,255,0.08)"; el.style.color = "rgba(255,255,255,0.45)"; el.style.background = "transparent"; }}>
                <t.icon size={11} /> {t.label}
              </button>
            ))}
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", marginLeft: "auto" }}>Enter to send</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes statusPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
        textarea::placeholder { color: rgba(255,255,255,0.28); }
        .loop-container { height: calc(100dvh - 44px); }
        @media (max-width: 1023px) {
          .loop-container { height: calc(100dvh - 100px); }
        }
        @media (max-width: 1023px) {
          .suggestions-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
