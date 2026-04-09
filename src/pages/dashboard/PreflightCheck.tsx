import { useState, useRef, useCallback, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { extractAudioFromFile, needsExtraction, MAX_WHISPER_SIZE } from "@/lib/audioExtractor";
import { toast } from "sonner";
import { PersonaWarningModal } from "@/components/dashboard/PersonaWarningModal";
import { useLanguage } from "@/i18n/LanguageContext";
import { Loader2, X, ChevronDown, Check, RotateCcw, Sparkles, AlertTriangle } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type PageState = "idle" | "ready" | "analyzing" | "result";

interface FileInfo {
  file: File;
  type: "video" | "image";
  preview?: string;
}

interface SpellingIssue { found: string; fix: string; }

interface CheckResult {
  headline: string;
  subline: string;
  verdict: "READY" | "REVIEW" | "BLOCKED";
  metrics: Array<{ label: string; value: string; delta?: string; color: "green" | "amber" | "red" | "blue" }>;
  diagnosis: string;
  fixes: string[];
  strengths: string[];
  spelling_issues?: SpellingIssue[];
  raw?: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Platform → placements hierarchy
const PLATFORM_GROUPS = [
  {
    id: "instagram",
    label: "Instagram",
    placements: [
      { id: "feed",    label: "Feed"    },
      { id: "reels",   label: "Reels"   },
      { id: "stories", label: "Stories" },
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    placements: [
      { id: "tiktok_feed", label: "Feed" },
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    placements: [
      { id: "fb_feed",    label: "Feed"    },
      { id: "fb_reels",   label: "Reels"   },
      { id: "fb_stories", label: "Stories" },
    ],
  },
  {
    id: "youtube",
    label: "YouTube",
    placements: [
      { id: "yt_shorts",    label: "Shorts"    },
      { id: "yt_instream",  label: "In-stream" },
    ],
  },
  {
    id: "google",
    label: "Google",
    placements: [
      { id: "google_uac",  label: "UAC"             },
      { id: "google_pmax", label: "Performance Max" },
    ],
  },
];

// For backwards compat with run-preflight API
function platformsToApiString(selected: Record<string, string[]>): string {
  return Object.entries(selected)
    .filter(([, placements]) => placements.length > 0)
    .map(([pid, placements]) => {
      const g = PLATFORM_GROUPS.find(g => g.id === pid);
      return `${g?.label || pid} (${placements.map(plid => g?.placements.find(p => p.id === plid)?.label || plid).join(", ")})`;
    })
    .join(", ");
}

// Legacy — kept for run-preflight compat (takes first platform/placement)
function getPrimaryPlatform(selected: Record<string, string[]>): string {
  for (const g of PLATFORM_GROUPS) {
    if (selected[g.id]?.length > 0) {
      const pl = selected[g.id][0];
      if (pl === "reels" || pl === "fb_reels") return "reels";
      if (pl === "stories" || pl === "fb_stories") return "stories";
      if (pl === "yt_shorts") return "youtube_shorts";
      if (pl === "google_uac" || pl === "google_pmax") return "google_uac";
      if (pl === "tiktok_feed") return "tiktok";
      if (pl === "feed" || pl === "fb_feed") return g.id === "instagram" ? "reels" : "facebook";
    }
  }
  return "tiktok";
}

const ALL_MARKETS = [
  { value: "BR", flag: "🇧🇷", label: "Brasil" },
  { value: "MX", flag: "🇲🇽", label: "México" },
  { value: "AR", flag: "🇦🇷", label: "Argentina" },
  { value: "CO", flag: "🇨🇴", label: "Colombia" },
  { value: "CL", flag: "🇨🇱", label: "Chile" },
  { value: "PE", flag: "🇵🇪", label: "Peru" },
  { value: "UY", flag: "🇺🇾", label: "Uruguay" },
  { value: "PY", flag: "🇵🇾", label: "Paraguay" },
  { value: "EC", flag: "🇪🇨", label: "Ecuador" },
  { value: "BO", flag: "🇧🇴", label: "Bolivia" },
  { value: "VE", flag: "🇻🇪", label: "Venezuela" },
  { value: "US", flag: "🇺🇸", label: "Estados Unidos" },
  { value: "CA", flag: "🇨🇦", label: "Canada" },
  { value: "GB", flag: "🇬🇧", label: "Reino Unido" },
  { value: "ES", flag: "🇪🇸", label: "Espanha" },
  { value: "PT", flag: "🇵🇹", label: "Portugal" },
  { value: "DE", flag: "🇩🇪", label: "Alemanha" },
  { value: "FR", flag: "🇫🇷", label: "França" },
  { value: "IT", flag: "🇮🇹", label: "Itália" },
  { value: "NL", flag: "🇳🇱", label: "Holanda" },
  { value: "SE", flag: "🇸🇪", label: "Suécia" },
  { value: "NO", flag: "🇳🇴", label: "Noruega" },
  { value: "DK", flag: "🇩🇰", label: "Dinamarca" },
  { value: "CH", flag: "🇨🇭", label: "Suíça" },
  { value: "AU", flag: "🇦🇺", label: "Austrália" },
  { value: "NZ", flag: "🇳🇿", label: "Nova Zelândia" },
  { value: "IN", flag: "🇮🇳", label: "Índia" },
  { value: "JP", flag: "🇯🇵", label: "Japão" },
  { value: "KR", flag: "🇰🇷", label: "Coreia do Sul" },
  { value: "SG", flag: "🇸🇬", label: "Singapura" },
  { value: "ID", flag: "🇮🇩", label: "Indonésia" },
  { value: "TH", flag: "🇹🇭", label: "Tailândia" },
  { value: "PH", flag: "🇵🇭", label: "Filipinas" },
  { value: "MY", flag: "🇲🇾", label: "Malásia" },
  { value: "AE", flag: "🇦🇪", label: "Emirados Árabes" },
  { value: "SA", flag: "🇸🇦", label: "Arábia Saudita" },
  { value: "ZA", flag: "🇿🇦", label: "África do Sul" },
  { value: "NG", flag: "🇳🇬", label: "Nigéria" },
  { value: "EG", flag: "🇪🇬", label: "Egito" },
  { value: "GLOBAL", flag: "🌐", label: "Global" },
];

const VERDICT_CFG = {
  READY:   { color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.22)", label: "Aprovado" },
  REVIEW:  { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.22)", label: "Revisar" },
  BLOCKED: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.22)",  label: "Bloqueado" },
};

const METRIC_COLORS = {
  green: { value: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.16)" },
  amber: { value: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.16)" },
  red:   { value: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.16)"  },
  blue:  { value: "#0da2e7", bg: "rgba(13,162,231,0.08)",  border: "rgba(13,162,231,0.16)" },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatFileSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1024 / 1024).toFixed(1)}MB`;
}

function getFileType(f: File): "video" | "image" {
  if (f.type.startsWith("video/")) return "video";
  if (f.type.startsWith("image/")) return "image";
  const ext = f.name.split(".").pop()?.toLowerCase() || "";
  return ["mp4","mov","avi","webm","mkv"].includes(ext) ? "video" : "image";
}

function renderDiagnosis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      const isRisk = /risco|bloqueado|problem|erro|evite|cuidado/i.test(inner);
      const isOk   = /forte|correto|aprovado|excelente|funciona/i.test(inner);
      return (
        <strong key={i} style={{
          color: isRisk ? "#f59e0b" : isOk ? "#10b981" : "#0da2e7",
          fontWeight: 700,
        }}>
          {inner}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKET DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

function MarketDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const sel = ALL_MARKETS.find(m => m.value === value) || ALL_MARKETS[0];
  const filtered = ALL_MARKETS.filter(m =>
    m.label.toLowerCase().includes(search.toLowerCase()) ||
    m.value.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" as const }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "8px 12px", borderRadius: 10, cursor: "pointer",
          background: open ? "rgba(13,162,231,0.1)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "rgba(13,162,231,0.3)" : "rgba(255,255,255,0.08)"}`,
          color: "#f0f2f8", fontSize: 13, fontWeight: 500,
          transition: "all 0.15s", whiteSpace: "nowrap" as const,
        }}
      >
        <span style={{ fontSize: 15 }}>{sel.flag}</span>
        <span>{sel.label}</span>
        <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.3)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div style={{
          position: "absolute" as const, top: "calc(100% + 6px)", left: 0, zIndex: 999,
          background: "#0d1017", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12, boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          width: 220, maxHeight: 280, overflow: "hidden",
          display: "flex", flexDirection: "column" as const,
          animation: "dropIn 0.15s cubic-bezier(0.34,1.4,0.64,1)",
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar país..."
              style={{ width: "100%", padding: "6px 10px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#f0f2f8", fontSize: 12, outline: "none", boxSizing: "border-box" as const }}
            />
          </div>
          <div style={{ overflowY: "auto" as const, flex: 1 }}>
            {filtered.map(m => (
              <button key={m.value}
                onClick={() => { onChange(m.value); setOpen(false); setSearch(""); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "8px 12px", cursor: "pointer",
                  background: m.value === value ? "rgba(13,162,231,0.1)" : "transparent",
                  border: "none", color: m.value === value ? "#0da2e7" : "rgba(255,255,255,0.7)",
                  fontSize: 13, textAlign: "left" as const, transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (m.value !== value) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (m.value !== value) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 15 }}>{m.flag}</span>
                <span style={{ flex: 1 }}>{m.label}</span>
                {m.value === value && <Check size={11} style={{ color: "#0da2e7" }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT CARD
// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({ result, onReset }: { result: CheckResult; onReset: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 40); return () => clearTimeout(t); }, []);
  const vc = VERDICT_CFG[result.verdict];
  const mono = { fontFamily: "'DM Mono',monospace" };

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: "all 0.45s cubic-bezier(0.34,1.1,0.64,1)",
    }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 20, fontSize: 10.5, fontWeight: 700,
              letterSpacing: "0.07em", textTransform: "uppercase" as const,
              background: vc.bg, border: `1px solid ${vc.border}`, color: vc.color,
            }}>
              {result.verdict === "READY"   && <Check size={9} />}
              {result.verdict === "REVIEW"  && <AlertTriangle size={9} />}
              {result.verdict === "BLOCKED" && <X size={9} />}
              {vc.label}
            </span>
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: "#f0f2f8", letterSpacing: "-0.03em", lineHeight: 1.35, margin: 0 }}>
            {result.headline}
          </h2>
          <p style={{ marginTop: 5, fontSize: 11.5, color: "rgba(255,255,255,0.28)", ...mono }}>
            {result.subline}
          </p>
        </div>
        <button onClick={onReset} title="Nova análise"
          style={{ width: 32, height: 32, borderRadius: 9, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#fff"; el.style.borderColor = "rgba(255,255,255,0.18)"; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(255,255,255,0.3)"; el.style.borderColor = "rgba(255,255,255,0.07)"; }}
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Metrics */}
      {result.metrics.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${result.metrics.length}, 1fr)`, gap: 9, marginBottom: 18 }}>
          {result.metrics.map((m, i) => {
            const mc = METRIC_COLORS[m.color];
            return (
              <div key={i} style={{
                padding: "13px 15px", borderRadius: 12,
                background: mc.bg, border: `1px solid ${mc.border}`,
                animation: `slideUp 0.3s cubic-bezier(0.34,1.1,0.64,1) ${i * 55}ms both`,
              }}>
                <p style={{ margin: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.32)", ...mono }}>
                  {m.label}
                </p>
                <p style={{ margin: "5px 0 0", fontSize: 24, fontWeight: 800, color: mc.value, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {m.value}
                </p>
                {m.delta && (
                  <p style={{ margin: "3px 0 0", fontSize: 10.5, color: "rgba(255,255,255,0.28)", ...mono }}>
                    {m.delta}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Diagnosis */}
      <div style={{
        padding: "15px 17px", borderRadius: 12,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        marginBottom: 14,
        animation: "slideUp 0.35s cubic-bezier(0.34,1.1,0.64,1) 100ms both",
      }}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "rgba(255,255,255,0.72)" }}>
          {renderDiagnosis(result.diagnosis)}
        </p>
      </div>

      {/* Spelling errors */}
      {result.spelling_issues && result.spelling_issues.length > 0 && (
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.14)",
          marginBottom: 14,
          animation: "slideUp 0.35s cubic-bezier(0.34,1.1,0.64,1) 130ms both",
        }}>
          <p style={{ margin: "0 0 9px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: "#ef4444", textTransform: "uppercase" as const, ...mono }}>
            Erros de escrita
          </p>
          {result.spelling_issues.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < (result.spelling_issues?.length || 0) - 1 ? 5 : 0 }}>
              <span style={{ fontSize: 12.5, color: "#ef4444", textDecoration: "line-through", ...mono }}>{s.found}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>→</span>
              <span style={{ fontSize: 12.5, color: "#10b981", ...mono }}>{s.fix}</span>
            </div>
          ))}
        </div>
      )}

      {/* What to fix */}
      {result.fixes.length > 0 && (
        <div style={{
          padding: "15px 17px", borderRadius: 12,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          marginBottom: 14,
          animation: "slideUp 0.35s cubic-bezier(0.34,1.1,0.64,1) 160ms both",
        }}>
          <p style={{ margin: "0 0 10px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.28)", textTransform: "uppercase" as const, ...mono }}>
            O que ajustar
          </p>
          {result.fixes.map((fix, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < result.fixes.length - 1 ? 8 : 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#0da2e7", marginTop: 8, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.68)", lineHeight: 1.6 }}>{fix}</span>
            </div>
          ))}
        </div>
      )}

      {/* Strengths */}
      {result.strengths.length > 0 && (
        <div style={{
          padding: "15px 17px", borderRadius: 12,
          background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.11)",
          animation: "slideUp 0.35s cubic-bezier(0.34,1.1,0.64,1) 190ms both",
        }}>
          <p style={{ margin: "0 0 10px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", color: "#10b981", textTransform: "uppercase" as const, ...mono }}>
            O que está funcionando
          </p>
          {result.strengths.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < result.strengths.length - 1 ? 8 : 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", marginTop: 8, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.68)", lineHeight: 1.6 }}>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildHeadline(raw: any): string {
  if (raw.verdict_reason) return raw.verdict_reason;
  const score = raw.score || 0;
  const verdict = raw.verdict || "REVIEW";
  if (verdict === "READY") return `Aprovado — score ${score}/100.`;
  if (verdict === "BLOCKED") return `Bloqueado — ${raw.compliance?.[0]?.detail || "problema crítico encontrado."}`;
  return `Score ${score}/100 — ajustes necessários antes de publicar.`;
}

function buildMetrics(raw: any): CheckResult["metrics"] {
  const m: CheckResult["metrics"] = [];
  if (raw.hook_analysis?.score !== undefined) {
    const s = raw.hook_analysis.score;
    m.push({ label: "Hook", value: `${s}/10`, color: s >= 7 ? "green" : s >= 5 ? "amber" : "red" });
  }
  if (raw.estimated_hook_score !== undefined) {
    const hs = raw.estimated_hook_score;
    m.push({ label: "Hook Rate est.", value: `${hs}%`, delta: hs >= 35 ? "acima da média" : hs >= 20 ? "na média" : "abaixo da média", color: hs >= 35 ? "green" : hs >= 20 ? "amber" : "red" });
  }
  if (raw.compliance?.length > 0) {
    const blocked = raw.compliance.some((c: any) => ["FLAG","BLOCKED","CRITICAL"].includes(c.status));
    const clear   = raw.compliance.every((c: any) => c.status === "CLEAR");
    m.push({ label: "Compliance", value: blocked ? "⚠ Risco" : clear ? "✓ Ok" : "Revisar", color: blocked ? "red" : clear ? "green" : "amber" });
  }
  return m;
}

function buildDiagnosis(raw: any): string {
  const parts: string[] = [];
  if (raw.hook_analysis?.detail) parts.push(raw.hook_analysis.detail);
  if (raw.cta_check?.detail) parts.push(raw.cta_check.detail);
  const issue = raw.compliance?.find((c: any) => c.status !== "CLEAR");
  if (issue) parts.push(issue.detail);
  return parts.filter(Boolean).join(" ") || raw.verdict_reason || "Análise completa.";
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function PreflightCheck() {
  const { selectedPersona, user } = useOutletContext<DashboardContext>();
  const { language: lang } = useLanguage();

  const [pageState, setPageState] = useState<PageState>("idle");
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  // selectedPlatforms: { platformId: [placementId, ...] }
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, string[]>>({ instagram: ["feed", "reels"] });
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>("instagram");
  const [market, setMarket] = useState("BR");
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [showPersonaWarning, setShowPersonaWarning] = useState(false);
  const [pendingRun, setPendingRun] = useState(false);
  const [analyzingText, setAnalyzingText] = useState("Analisando...");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mono = { fontFamily: "'DM Mono',monospace" };

  // Auto-detect market from persona
  useEffect(() => {
    const r = selectedPersona?.result as any;
    if (r?.market) {
      const found = ALL_MARKETS.find(m => m.value === r.market || m.label.toLowerCase() === r.market.toLowerCase());
      if (found) setMarket(found.value);
    }
  }, [selectedPersona?.id]);

  // Cycling analyzing text
  useEffect(() => {
    if (pageState !== "analyzing") return;
    const msgs = ["Analisando estrutura...","Verificando compliance...","Avaliando hook...","Checando CTA...","Gerando diagnóstico..."];
    let i = 0;
    const iv = setInterval(() => { i = (i + 1) % msgs.length; setAnalyzingText(msgs[i]); }, 1400);
    return () => clearInterval(iv);
  }, [pageState]);

  const processFile = useCallback((f: File) => {
    const type = getFileType(f);
    if (type === "image") {
      const reader = new FileReader();
      reader.onload = e => setFileInfo({ file: f, type, preview: e.target?.result as string });
      reader.readAsDataURL(f);
    } else {
      setFileInfo({ file: f, type });
    }
    setPageState("ready");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    processFile(f);
  }, [processFile]);

  const removeFile = useCallback(() => {
    setFileInfo(null); setResult(null); setPageState("idle");
  }, []);

  const analyze = useCallback(async () => {
    if (!fileInfo) return;
    const hasAnyPlatform = Object.values(selectedPlatforms).some(p => p.length > 0);
    if (!hasAnyPlatform) { toast.error("Selecione pelo menos uma plataforma"); return; }
    if (!selectedPersona && !pendingRun) { setShowPersonaWarning(true); setPendingRun(true); return; }
    setPendingRun(false);
    setPageState("analyzing");

    try {
      let rawData: any;

      if (fileInfo.type === "video") {
        let fileToSend: File = fileInfo.file;
        if (needsExtraction(fileInfo.file)) {
          try {
            fileToSend = await extractAudioFromFile(fileInfo.file);
            if (fileToSend.size > MAX_WHISPER_SIZE) { toast.error("Arquivo muito grande. Tente um vídeo mais curto."); setPageState("ready"); return; }
          } catch (err: any) { toast.error(err.message || "Não foi possível processar o arquivo."); setPageState("ready"); return; }
        }
        const fd = new FormData();
        fd.append("video_file", fileToSend);
        fd.append("platform", getPrimaryPlatform(selectedPlatforms));
        fd.append("market", market);
        fd.append("duration", "30"); fd.append("format", "video");
        fd.append("product", selectedPersona?.name || "");
        fd.append("funnel_stage", "tofu");
        if (selectedPersona) fd.append("persona_context", JSON.stringify(selectedPersona));
        if (user?.id) fd.append("user_id", user.id);
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-preflight`,
          { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
        if (!res.ok) throw new Error("Análise falhou. Tente novamente.");
        rawData = await res.json();
      } else {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve((e.target?.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(fileInfo.file);
        });
        // Images: route to adbrief-ai-chat (has vision) then parse result
        const platformsStr = platformsToApiString(selectedPlatforms);
        const { data: chatData, error: chatError } = await supabase.functions.invoke("adbrief-ai-chat", {
          body: {
            user_id: user?.id,
            persona_id: selectedPersona?.id || null,
            user_language: lang,
            image_base64: base64,
            image_media_type: fileInfo.file.type || "image/jpeg",
            message: `Analyze this static ad creative. Platform: ${platformsStr}. Market: ${market}.
Return a JSON object (no markdown) with:
{
  "verdict": "READY"|"REVIEW"|"BLOCKED",
  "verdict_reason": "one sentence diagnostic headline",
  "hook_analysis": { "score": 1-10, "detail": "text" },
  "estimated_hook_score": 0-100,
  "compliance": [{ "rule": "name", "status": "CLEAR"|"FLAG"|"BLOCKED", "detail": "text" }],
  "cta_check": { "detail": "text" },
  "top_fixes": ["fix1","fix2","fix3"],
  "strengths": ["strength1","strength2"],
  "language_check": { "issues": [{ "found": "wrong word", "fix": "correct word" }] }
}`,
            context: `=== ACTIVE ACCOUNT ===
${selectedPersona?.name || "Unknown"}
Market: ${market}
Platform: ${platformsStr}`,
            history: [],
          },
        });
        if (chatError) throw chatError;
        // Parse response from chat blocks
        const blocks = chatData?.blocks || chatData?.response?.blocks || [];
        const textBlock = blocks.find((b: any) => b.type === "text");
        const rawText = textBlock?.content || chatData?.content || "{}";
        try {
          rawData = JSON.parse(rawText.replace(/```json|```/g, "").trim());
        } catch {
          // Fallback: build minimal result from text
          rawData = { verdict: "REVIEW", verdict_reason: rawText.slice(0, 120), top_fixes: [], strengths: [] };
        }
      }

      const marketLabel = ALL_MARKETS.find(m => m.value === market)?.label || market;

      setResult({
        headline: buildHeadline(rawData),
        subline: `${fileInfo.file.name} · ${platformsToApiString(selectedPlatforms)} · ${marketLabel}`,
        verdict: rawData.verdict || "REVIEW",
        metrics: buildMetrics(rawData),
        diagnosis: buildDiagnosis(rawData),
        fixes: rawData.top_fixes || [],
        strengths: rawData.strengths || [],
        spelling_issues: rawData.language_check?.issues?.map((i: any) => ({ found: i.found, fix: i.fix })) || [],
        raw: rawData,
      });
      setPageState("result");

    } catch (err: any) {
      console.error("[preflight]", err);
      toast.error(err.message || "Algo deu errado. Tente novamente.");
      setPageState("ready");
    }
  }, [fileInfo, selectedPlatforms, market, selectedPersona, user, pendingRun, lang]);

  useEffect(() => {
    if (pendingRun && selectedPersona) analyze();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersona?.id]);

  return (
    <>
      <style>{`
        @keyframes dropIn  { from { opacity:0; transform:translateY(-8px) scale(.97) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes slideUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes scan    { 0% { transform:translateX(-100%) } 100% { transform:translateX(250%) } }
        @keyframes pulseBorder { 0%,100% { border-color:rgba(13,162,231,.25) } 50% { border-color:rgba(13,162,231,.6) } }
        .drop-zone:hover { border-color:rgba(13,162,231,.3) !important; background:rgba(13,162,231,.025) !important; }
        .pf-platform:hover { background:rgba(255,255,255,.07) !important; }
        .pf-platform.sel { background:rgba(13,162,231,.12) !important; border-color:rgba(13,162,231,.32) !important; color:#fff !important; }
        .pf-analyze:hover:not(:disabled) { background:#0891b2 !important; transform:translateY(-1px); box-shadow:0 10px 28px rgba(13,162,231,.3) !important; }
        .pf-analyze:active:not(:disabled) { transform:translateY(0) !important; }
        .pf-analyze:disabled { opacity:.45; cursor:not-allowed !important; }
      `}</style>

      <PersonaWarningModal
        open={showPersonaWarning}
        onClose={() => { setShowPersonaWarning(false); setPendingRun(false); }}
        onContinue={() => { setShowPersonaWarning(false); analyze(); }}
        toolName="preflight"
      />

      <div style={{ minHeight: "100vh", background: "#080a0f", fontFamily: "Inter,-apple-system,sans-serif" }}>
        <div style={{
          maxWidth: 660, margin: "0 auto", padding: "clamp(20px,4vw,32px) clamp(16px,4vw,28px) 60px",
          boxSizing: "border-box" as const,
        }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: 28, animation: "fadeIn .4s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h1 style={{ fontSize: "clamp(18px,3vw,22px)", fontWeight: 700, color: "#f0f2f8", letterSpacing: "-.03em", margin: 0 }}>
                  Check Criativo
                </h1>
                <p style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                  {pageState === "idle"      && "Arraste ou selecione seu criativo"}
                  {pageState === "ready"     && "Escolha a plataforma e o mercado"}
                  {pageState === "analyzing" && analyzingText}
                  {pageState === "result"    && "Análise completa"}
                </p>
              </div>
              {/* Progress dots */}
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {(["idle","ready","analyzing","result"] as PageState[]).map((s, i) => {
                  const states: PageState[] = ["idle","ready","analyzing","result"];
                  const cur = states.indexOf(pageState);
                  const idx = states.indexOf(s);
                  return (
                    <div key={s} style={{
                      width: pageState === s ? 18 : 5, height: 5, borderRadius: 3,
                      background: pageState === s ? "#0da2e7" : idx < cur ? "rgba(13,162,231,.35)" : "rgba(255,255,255,.08)",
                      transition: "all .35s cubic-bezier(.34,1.56,.64,1)",
                    }} />
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── IDLE: Drop zone ── */}
          {pageState === "idle" && (
            <div
              className="drop-zone"
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                minHeight: "clamp(220px,38vh,320px)", borderRadius: 20, cursor: "pointer",
                border: dragOver ? "1.5px dashed rgba(13,162,231,.55)" : "1.5px dashed rgba(255,255,255,.09)",
                background: dragOver ? "rgba(13,162,231,.04)" : "rgba(255,255,255,.015)",
                display: "flex", flexDirection: "column" as const,
                alignItems: "center", justifyContent: "center", gap: 14,
                transition: "all .2s ease",
                animation: dragOver ? "pulseBorder 1.2s ease infinite" : "fadeIn .5s ease",
              }}
            >
              <input ref={fileInputRef} type="file"
                accept="video/mp4,video/quicktime,video/avi,video/webm,image/png,image/jpeg,image/gif,image/webp"
                style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
              />
              <div style={{
                width: 50, height: 50, borderRadius: 15,
                background: dragOver ? "rgba(13,162,231,.14)" : "rgba(255,255,255,.035)",
                border: dragOver ? "1px solid rgba(13,162,231,.28)" : "1px solid rgba(255,255,255,.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transform: dragOver ? "scale(1.1)" : "scale(1)", transition: "all .2s ease",
              }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
                  stroke={dragOver ? "#0da2e7" : "rgba(255,255,255,.32)"}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div style={{ textAlign: "center" as const }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: dragOver ? "#0da2e7" : "rgba(255,255,255,.55)", transition: "color .2s" }}>
                  {dragOver ? "Solte aqui" : "Solte seu criativo aqui"}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,.22)", ...mono }}>
                  ou clique para selecionar
                </p>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const, justifyContent: "center" }}>
                {["mp4","mov","png","jpg","gif","webm"].map(ext => (
                  <span key={ext} style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, ...mono, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", color: "rgba(255,255,255,.2)", textTransform: "uppercase" as const }}>
                    {ext}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── READY / ANALYZING ── */}
          {(pageState === "ready" || pageState === "analyzing") && fileInfo && (
            <div style={{ animation: "slideUp .35s cubic-bezier(.34,1.1,.64,1)" }}>

              {/* File card */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "13px 15px", borderRadius: 14, marginBottom: 22,
                background: "rgba(13,162,231,.06)", border: "1px solid rgba(13,162,231,.16)",
                position: "relative" as const, overflow: "hidden",
              }}>
                {pageState === "analyzing" && (
                  <div style={{
                    position: "absolute" as const, inset: 0, pointerEvents: "none" as const,
                    background: "linear-gradient(90deg,transparent,rgba(13,162,231,.1),transparent)",
                    animation: "scan 1.8s linear infinite",
                  }} />
                )}
                {fileInfo.type === "image" && fileInfo.preview
                  ? <img src={fileInfo.preview} alt="" style={{ width: 42, height: 42, borderRadius: 8, objectFit: "cover" as const, border: "1px solid rgba(255,255,255,.08)", flexShrink: 0 }} />
                  : (
                    <div style={{ width: 42, height: 42, borderRadius: 8, flexShrink: 0, background: "rgba(13,162,231,.1)", border: "1px solid rgba(13,162,231,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {fileInfo.type === "video"
                        ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0da2e7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                        : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0da2e7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      }
                    </div>
                  )
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#f0f2f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{fileInfo.file.name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,.28)", ...mono }}>
                    {formatFileSize(fileInfo.file.size)} · {fileInfo.type === "video" ? "Vídeo" : "Imagem"}
                    {pageState === "analyzing" && " · analisando..."}
                  </p>
                </div>
                {pageState === "ready"
                  ? <button onClick={removeFile} style={{ width: 26, height: 26, borderRadius: 6, cursor: "pointer", background: "transparent", border: "none", color: "rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "color .15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.7)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.22)"; }}>
                      <X size={13} />
                    </button>
                  : <Loader2 size={15} className="animate-spin" style={{ color: "#0da2e7", flexShrink: 0 }} />
                }
              </div>

              {pageState === "ready" && (
                <>
                  {/* Platform — hierarchical */}
                  <div style={{ marginBottom: 18 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 600, letterSpacing: ".12em", color: "rgba(255,255,255,.22)", textTransform: "uppercase" as const, fontFamily: "Inter,-apple-system,sans-serif" }}>
                      Plataforma
                    </p>
                    {/* Platform row */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 10 }}>
                      {PLATFORM_GROUPS.map((g, i) => {
                        const isSelected = selectedPlatforms[g.id]?.length > 0;
                        const isExpanded = expandedPlatform === g.id;
                        return (
                          <button key={g.id}
                            onClick={() => {
                              setExpandedPlatform(isExpanded ? null : g.id);
                              // Auto-select all placements on first click if none selected
                              if (!isSelected) {
                                setSelectedPlatforms(prev => ({ ...prev, [g.id]: g.placements.map(p => p.id) }));
                              }
                            }}
                            style={{
                              padding: "6px 13px", borderRadius: 8, cursor: "pointer",
                              background: isSelected ? "rgba(13,162,231,.1)" : "rgba(255,255,255,.03)",
                              border: `1px solid ${isExpanded ? "rgba(13,162,231,.4)" : isSelected ? "rgba(13,162,231,.22)" : "rgba(255,255,255,.07)"}`,
                              color: isSelected ? "#e8f4fd" : "rgba(255,255,255,.42)",
                              fontSize: 12.5, fontWeight: isSelected ? 600 : 400,
                              fontFamily: "Inter,-apple-system,sans-serif",
                              letterSpacing: "-.01em",
                              transition: "all .15s",
                              animation: `slideUp .28s cubic-bezier(.34,1.1,.64,1) ${i * 35}ms both`,
                              display: "flex", alignItems: "center", gap: 5,
                            }}
                            onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.65)"; }}
                            onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.42)"; }}
                          >
                            {g.label}
                            {isSelected && (
                              <span style={{ fontSize: 10, background: "rgba(13,162,231,.25)", color: "#0da2e7", padding: "1px 5px", borderRadius: 4, fontWeight: 700, letterSpacing: ".02em" }}>
                                {selectedPlatforms[g.id].length}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Expanded placements */}
                    {expandedPlatform && (() => {
                      const g = PLATFORM_GROUPS.find(g => g.id === expandedPlatform);
                      if (!g) return null;
                      const selPlacements = selectedPlatforms[g.id] || [];
                      return (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const,
                          padding: "10px 12px", borderRadius: 10,
                          background: "rgba(13,162,231,.04)", border: "1px solid rgba(13,162,231,.12)",
                          animation: "slideUp .2s ease",
                        }}>
                          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,.3)", fontFamily: "Inter,-apple-system,sans-serif", marginRight: 2 }}>
                            {g.label}:
                          </span>
                          {g.placements.map(p => {
                            const active = selPlacements.includes(p.id);
                            return (
                              <button key={p.id}
                                onClick={() => {
                                  setSelectedPlatforms(prev => {
                                    const cur = prev[g.id] || [];
                                    return { ...prev, [g.id]: active ? cur.filter(x => x !== p.id) : [...cur, p.id] };
                                  });
                                }}
                                style={{
                                  padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                                  background: active ? "rgba(13,162,231,.15)" : "rgba(255,255,255,.04)",
                                  border: `1px solid ${active ? "rgba(13,162,231,.35)" : "rgba(255,255,255,.08)"}`,
                                  color: active ? "#e8f4fd" : "rgba(255,255,255,.38)",
                                  fontSize: 12, fontWeight: active ? 600 : 400,
                                  fontFamily: "Inter,-apple-system,sans-serif",
                                  transition: "all .12s",
                                  display: "flex", alignItems: "center", gap: 5,
                                }}
                              >
                                {active && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0da2e7", display: "inline-block" }} />}
                                {p.label}
                              </button>
                            );
                          })}
                          {/* Deselect all for this platform */}
                          {selPlacements.length > 0 && (
                            <button
                              onClick={() => setSelectedPlatforms(prev => ({ ...prev, [g.id]: [] }))}
                              style={{ marginLeft: "auto", padding: "3px 8px", borderRadius: 5, cursor: "pointer", background: "transparent", border: "1px solid rgba(255,255,255,.06)", color: "rgba(255,255,255,.22)", fontSize: 10.5, fontFamily: "Inter,-apple-system,sans-serif", transition: "all .12s" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(239,68,68,.7)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,.2)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.22)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.06)"; }}
                            >
                              remover
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Market */}
                  <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: ".12em", color: "rgba(255,255,255,.22)", textTransform: "uppercase" as const, fontFamily: "Inter,-apple-system,sans-serif" }}>Mercado</p>
                    <MarketDropdown value={market} onChange={setMarket} />
                  </div>

                  {/* Analyze button */}
                  <button onClick={analyze} className="pf-analyze"
                    style={{
                      width: "100%", padding: "13px 24px", borderRadius: 14, border: "none",
                      cursor: "pointer", background: "#0da2e7", color: "#fff", fontSize: 14,
                      fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 8, transition: "all .2s ease", boxShadow: "0 4px 18px rgba(13,162,231,.2)",
                    }}>
                    <Sparkles size={15} />
                    Analisar criativo
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── RESULT ── */}
          {pageState === "result" && result && (
            <ResultCard result={result} onReset={removeFile} />
          )}

        </div>
      </div>
    </>
  );
}
