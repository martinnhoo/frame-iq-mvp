import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Brain, TrendingUp, Target, Zap, BarChart3, RefreshCw, Loader2,
  Upload, FileText, ChevronDown, ChevronUp, Sparkles, AlertCircle,
  DollarSign, MousePointer, Eye, ShoppingCart, X, CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisRow {
  id: string; created_at: string;
  result: Record<string, unknown> | null;
  hook_strength: string | null; hook_score?: number | null; status: string;
}
interface ModelStat {
  model: string; count: number; avgScore: number;
  hookDistribution: Record<string, number>; topPlatforms: string[];
}
interface AdsImport {
  id: string; platform: string; filename: string; date_range: string | null;
  total_ads: number | null; total_spend: number | null; currency: string | null;
  result: Record<string, unknown>; created_at: string;
}
interface ParsedAds {
  platform: string; date_range: string; total_ads: number; total_spend: number | null;
  currency: string; summary: string;
  top_creatives: Array<{
    name: string; spend: number | null; impressions: number | null; clicks: number | null;
    ctr: number | null; cpc: number | null; cpm: number | null;
    conversions: number | null; cpa: number | null; roas: number | null;
    hook_rate: number | null; hold_rate: number | null; format: string; why_winning: string;
  }>;
  worst_creatives: Array<{ name: string; spend: number|null; ctr: number|null; cpa: number|null; why_losing: string }>;
  insights: string[];
  patterns: { best_format: string; best_hook_style: string; audience_signal: string; budget_efficiency: string };
  recommended_actions: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_META: Record<string, { label: string; emoji: string; color: string; accent: string }> = {
  meta:    { label: "Meta Ads",    emoji: "📘", color: "#60a5fa", accent: "rgba(96,165,250,0.15)" },
  google:  { label: "Google Ads",  emoji: "🔍", color: "#34d399", accent: "rgba(52,211,153,0.15)" },
  tiktok:  { label: "TikTok Ads",  emoji: "🎵", color: "#f472b6", accent: "rgba(244,114,182,0.15)" },
  other:   { label: "Other",       emoji: "📊", color: "#a78bfa", accent: "rgba(167,139,250,0.15)" },
  unknown: { label: "Ads Data",    emoji: "📊", color: "#a78bfa", accent: "rgba(167,139,250,0.15)" },
};

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  meta:   "Ads Manager → Reports → Export (CSV). Include: Ad Name, Amount Spent, Impressions, Clicks, CTR, CPC, CPM, Results, Cost per Result, ROAS, Video Hook Rate, Video Watches at 25%.",
  google: "Google Ads → Reports → Predefined reports → Ad performance. Export CSV with: Campaign, Ad group, Ad, Impressions, Clicks, CTR, Avg CPC, Cost, Conversions, Conv. rate, ROAS.",
  tiktok: "TikTok Ads Manager → Reporting → Custom Report → Ad level. Include: Ad Name, Spend, Impressions, Clicks, CTR, CPC, CPM, Conversions, CPA, Video play actions, 2-second video views.",
  other:  "Export your ad performance data as CSV from any platform. Include columns like: Ad Name, Spend, Impressions, Clicks, CTR, CPC, Conversions, CPA, ROAS. The AI will auto-detect the format.",
};

const MODEL_LABELS: Record<string, { emoji: string; color: string }> = {
  "UGC":              { emoji: "📱", color: "#a78bfa" },
  "Testimonial":      { emoji: "⭐", color: "#34d399" },
  "Tutorial":         { emoji: "🎓", color: "#60a5fa" },
  "Problem-Solution": { emoji: "🔧", color: "#fb923c" },
  "Before-After":     { emoji: "✨", color: "#f472b6" },
  "Promo":            { emoji: "🔥", color: "#f87171" },
  "Demo":             { emoji: "📦", color: "#38bdf8" },
  "Talking-Head":     { emoji: "🎙️", color: "#fbbf24" },
  "General":          { emoji: "🎯", color: "#ffffff40" },
};

const mono = { fontFamily: "'DM Mono', monospace" } as const;
const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined, prefix = "", decimals = 1) =>
  n == null ? "—" : `${prefix}${n.toLocaleString("en-US", { maximumFractionDigits: decimals })}`;
const fmtPct = (n: number | null | undefined) => n == null ? "—" : `${(n * 100).toFixed(1)}%`;

function getModelFromResult(row: AnalysisRow): string {
  if (!row.result) return "General";
  const cm = String(row.result.creative_model || row.result.format || "General");
  for (const key of Object.keys(MODEL_LABELS)) {
    if (cm.toLowerCase().includes(key.toLowerCase())) return key;
  }
  return "General";
}
function getScore(row: AnalysisRow): number | null {
  if (row.hook_score) return Number(row.hook_score);
  if (row.result?.hook_score) return Number(row.result.hook_score);
  return null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-3" style={mono}>{label}</p>
    {children}
  </div>
);

const KpiCard = ({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) => (
  <div className="rounded-2xl border border-white/[0.13] p-4" style={{ background: "#0a0a0d" }}>
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      <p className="text-[10px] uppercase tracking-widest text-white/40" style={mono}>{label}</p>
    </div>
    <p className="text-xl font-bold text-white truncate" style={syne}>{value}</p>
  </div>
);

// ── Upload Panel ──────────────────────────────────────────────────────────────

function AdsUploadPanel({ userId, onImported, personaContext }: { userId: string; onImported: () => void; personaContext?: string }) {
  const [platform, setPlatform] = useState<"meta"|"google"|"tiktok"|"other">("meta");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [context, setContext] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.match(/\.(csv|xlsx|xls|tsv)$/i)) {
      toast.error("Please upload a CSV, TSV or Excel file.");
      return;
    }
    setFile(f);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const parseFile = async () => {
    if (!file) return;
    setParsing(true);
    try {
      let text: string;
      if (file.name.match(/\.xlsx?$/i)) {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        const wb = XLSX.read(data, { type: "array", codepage: 65001 });
        const sheetName = wb.SheetNames[0];
        if (!sheetName || !wb.Sheets[sheetName]) throw new Error("No readable sheet found in the file.");
        const ws = wb.Sheets[sheetName];
        text = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
        if (!text || text.trim().length < 10) throw new Error("The spreadsheet appears to be empty.");
        console.log(`[XLSX] Sheet "${sheetName}" → ${text.length} chars, first 200: ${text.slice(0, 200)}`);
      } else {
        text = await file.text();
      }
      const { data, error } = await supabase.functions.invoke("parse-ads-data", {
        body: {
          user_id: userId, platform, csv_data: text, filename: file.name,
          context: context.trim() || undefined,
          persona_context: personaContext || undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.result?.error) throw new Error("AI could not parse this file format.");
      toast.success("Data imported and analyzed successfully!");
      setFile(null);
      setContext("");
      onImported();
    } catch (err) {
      toast.error((err as Error).message || "Something went wrong.");
    } finally {
      setParsing(false);
    }
  };

  const pm = PLATFORM_META[platform];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "#0a0a0d" }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center"
            style={{ background: pm.accent, border: `1px solid ${pm.color}30` }}>
            <Upload className="h-3.5 w-3.5" style={{ color: pm.color }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white" style={syne}>Import Ad Performance Data</p>
            <p className="text-[11px] text-white/50">Upload your platform CSV export — AI extracts creative insights</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Platform selector */}
        <div>
          <p className="text-[10px] text-white/50 mb-2 uppercase tracking-wider" style={mono}>Select platform</p>
          <div className="flex gap-2">
            {(["meta", "google", "tiktok", "other"] as const).map(p => {
              const m = PLATFORM_META[p];
              return (
                <button key={p} onClick={() => setPlatform(p)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={platform === p
                    ? { background: m.accent, border: `1px solid ${m.color}50`, color: m.color }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
                  <span className="text-base">{m.emoji}</span>
                  <span className="hidden sm:inline">{m.label.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Instructions toggle */}
        <button onClick={() => setShowInstructions(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] text-white/55 hover:text-white/55 transition-colors"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span>How to export from {PLATFORM_META[platform].label}</span>
          {showInstructions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {showInstructions && (
          <div className="rounded-xl px-4 py-3 text-[11px] text-white/40 leading-relaxed"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            {PLATFORM_INSTRUCTIONS[platform]}
          </div>
        )}

        {/* Drop zone */}
        {!file ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className="relative rounded-2xl border-2 border-dashed py-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
            style={{
              borderColor: dragging ? pm.color : "rgba(255,255,255,0.1)",
              background: dragging ? pm.accent : "rgba(255,255,255,0.02)",
            }}>
            <input ref={inputRef} type="file" accept=".csv,.tsv,.xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center"
              style={{ background: pm.accent, border: `1px solid ${pm.color}30` }}>
              <FileText className="h-5 w-5" style={{ color: pm.color }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white/60">Drop your CSV export here</p>
              <p className="text-[11px] text-white/45 mt-0.5">or click to browse — CSV, TSV, XLSX supported</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
            <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{file.name}</p>
              <p className="text-[11px] text-white/50">{(file.size / 1024).toFixed(0)} KB · {PLATFORM_META[platform].label}</p>
            </div>
            <button onClick={() => setFile(null)} className="text-white/40 hover:text-white/50 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Context field (optional) */}
        <div>
          <p className="text-[10px] text-white/50 mb-2 uppercase tracking-wider" style={mono}>
            Context <span className="normal-case text-white/15 font-sans">(optional — helps AI give better suggestions)</span>
          </p>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="E.g.: We're testing UGC vs. studio creatives for our skincare brand targeting women 25-40 in Brazil. Main goal is reducing CPA below R$30..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors resize-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
          />
        </div>

        {/* Analyze button */}
        <button
          onClick={parseFile}
          disabled={!file || parsing}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          style={{
            background: file && !parsing ? `linear-gradient(135deg, ${pm.color}30, ${pm.color}15)` : "rgba(255,255,255,0.05)",
            border: `1px solid ${file && !parsing ? pm.color + "50" : "rgba(255,255,255,0.08)"}`,
            color: file && !parsing ? pm.color : "rgba(255,255,255,0.3)",
          }}>
          {parsing
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing with AI...</>
            : <><Sparkles className="h-4 w-4" /> Analyze & Extract Insights</>}
        </button>
      </div>
    </div>
  );
}

// ── Import Result Card ────────────────────────────────────────────────────────

function ImportCard({ imp, onDelete }: { imp: AdsImport; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const r = imp.result as unknown as ParsedAds;
  const pm = PLATFORM_META[imp.platform] || PLATFORM_META.unknown;

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ border: "1px solid rgba(255,255,255,0.07)", background: "#0a0a0d" }}>

      {/* Card header */}
      <div className="px-4 py-3.5 flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-lg"
          style={{ background: pm.accent }}>
          {pm.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white truncate">{imp.filename}</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
              style={{ background: pm.accent, color: pm.color, ...mono }}>
              {pm.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {imp.date_range && <p className="text-[11px] text-white/50">{imp.date_range}</p>}
            {imp.total_ads && <p className="text-[11px] text-white/40">{imp.total_ads} ads</p>}
            {imp.total_spend && <p className="text-[11px] text-white/40">{imp.currency} {imp.total_spend.toLocaleString()} spent</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onDelete(imp.id)}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-white/15 hover:text-red-400 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setExpanded(v => !v)}
            className="h-7 px-2.5 rounded-lg text-[11px] flex items-center gap-1 text-white/50 hover:text-white/60 transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {expanded ? "Collapse" : "View insights"}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {r.summary && (
        <div className="px-4 pb-3">
          <p className="text-[11px] text-white/55 leading-relaxed">{r.summary}</p>
        </div>
      )}

      {expanded && (
        <div className="border-t border-white/[0.05] p-4 space-y-5">

          {/* KPIs */}
          {r.top_creatives?.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Top CTR", value: fmtPct(r.top_creatives[0]?.ctr), icon: MousePointer, color: pm.color },
                { label: "Top CPA", value: fmt(r.top_creatives[0]?.cpa, "$"), icon: DollarSign, color: pm.color },
                { label: "Top ROAS", value: fmt(r.top_creatives[0]?.roas, "", 2) + "x", icon: TrendingUp, color: pm.color },
                { label: "Hook Rate", value: fmtPct(r.top_creatives[0]?.hook_rate), icon: Eye, color: pm.color },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-3" style={{ background: pm.accent, border: `1px solid ${pm.color}20` }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <k.icon className="h-3 w-3" style={{ color: pm.color }} />
                    <p className="text-[10px] text-white/50 uppercase tracking-wider" style={mono}>{k.label}</p>
                  </div>
                  <p className="text-base font-bold text-white" style={mono}>{k.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Top creatives */}
          {r.top_creatives?.length > 0 && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2" style={mono}>Top Performing</p>
              <div className="space-y-2">
                {r.top_creatives.slice(0, 5).map((c, i) => (
                  <div key={i} className="rounded-xl px-3 py-2.5 flex items-start gap-3"
                    style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.12)" }}>
                    <span className="text-[10px] font-bold text-green-400 w-4 shrink-0 mt-0.5" style={mono}>#{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {c.ctr != null && <span className="text-[10px] text-white/50">CTR {fmtPct(c.ctr)}</span>}
                        {c.cpa != null && <span className="text-[10px] text-white/50">CPA {fmt(c.cpa, "$")}</span>}
                        {c.roas != null && <span className="text-[10px] text-white/50">ROAS {fmt(c.roas, "", 2)}x</span>}
                        {c.hook_rate != null && <span className="text-[10px] text-white/50">Hook {fmtPct(c.hook_rate)}</span>}
                        {c.spend != null && <span className="text-[10px] text-white/40">Spend {fmt(c.spend, "$", 0)}</span>}
                      </div>
                      {c.why_winning && <p className="text-[11px] text-green-400/60 mt-1">{c.why_winning}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Worst creatives */}
          {r.worst_creatives?.length > 0 && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2" style={mono}>Needs Attention</p>
              <div className="space-y-2">
                {r.worst_creatives.slice(0, 3).map((c, i) => (
                  <div key={i} className="rounded-xl px-3 py-2.5 flex items-start gap-3"
                    style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.12)" }}>
                    <AlertCircle className="h-3.5 w-3.5 text-yellow-400/60 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/70 truncate">{c.name}</p>
                      {c.why_losing && <p className="text-[11px] text-yellow-400/50 mt-0.5">{c.why_losing}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Patterns */}
          {r.patterns && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2" style={mono}>Patterns Detected</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(r.patterns).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[10px] text-white/45 capitalize mb-0.5" style={mono}>
                      {k.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-white/55">{v as string}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {r.insights?.length > 0 && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2" style={mono}>AI Insights</p>
              <ul className="space-y-1.5">
                {r.insights.map((ins, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/45 leading-relaxed">
                    <Sparkles className="h-3 w-3 text-violet-400/60 shrink-0 mt-0.5" />
                    {ins}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {r.recommended_actions?.length > 0 && (
            <div className="rounded-xl p-4"
              style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}>
              <p className="text-[10px] text-violet-400/60 uppercase tracking-widest mb-2.5" style={mono}>Recommended Next Actions</p>
              <ol className="space-y-2">
                {r.recommended_actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-white/55">
                    <span className="h-4 w-4 rounded-md bg-violet-500/20 text-violet-400 text-[10px] flex items-center justify-center shrink-0 font-bold" style={mono}>
                      {i+1}
                    </span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const { user, selectedPersona } = useOutletContext<DashboardContext>();
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [imports, setImports] = useState<AdsImport[]>([]);
  const [memoryData, setMemoryData] = useState<Array<{ hook_type: string; hook_score: number; platform: string; notes: string; created_at: string }>>([]);
  const [aiProfile, setAiProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [activeTab, setActiveTab] = useState<"creative" | "platform">("creative");

  const loadData = async () => {
    setLoading(true);
    const [{ data: an }, { data: pr }, { data: mem }, { data: imp }] = await Promise.all([
      supabase.from("analyses").select("id, created_at, result, hook_strength, status")
        .eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(200),
      supabase.from("user_ai_profile" as never).select("*" as never).eq("user_id" as never, user.id).maybeSingle(),
      supabase.from("creative_memory" as never).select("hook_type, hook_score, platform, notes, created_at" as never)
        .eq("user_id" as never, user.id).order("created_at" as never, { ascending: false }).limit(200),
      supabase.from("ads_data_imports" as never).select("*" as never)
        .eq("user_id" as never, user.id).order("created_at" as never, { ascending: false }),
    ]);
    if (an) setAnalyses(an as unknown as AnalysisRow[]);
    if (pr) setAiProfile(pr as Record<string, unknown>);
    if (mem) setMemoryData(mem as typeof memoryData);
    if (imp) setImports(imp as AdsImport[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user.id]);

  const rebuildProfile = async () => {
    setRebuilding(true);
    try {
      await supabase.functions.invoke("update-ai-profile", { body: { user_id: user.id, trigger: "manual_rebuild" } });
      await loadData();
    } catch {}
    setRebuilding(false);
  };

  const deleteImport = async (id: string) => {
    await supabase.from("ads_data_imports" as never).delete().eq("id" as never, id);
    setImports(prev => prev.filter(i => i.id !== id));
    toast.success("Import removed.");
  };

  // ── Computed stats ──────────────────────────────────────────────────────────
  const modelStats = useMemo((): ModelStat[] => {
    const map = new Map<string, { scores: number[]; hooks: Record<string, number>; platforms: string[] }>();
    analyses.forEach(row => {
      const model = getModelFromResult(row);
      if (!map.has(model)) map.set(model, { scores: [], hooks: {}, platforms: [] });
      const e = map.get(model)!;
      const s = getScore(row); if (s !== null) e.scores.push(s);
      if (row.hook_strength) e.hooks[row.hook_strength] = (e.hooks[row.hook_strength] || 0) + 1;
    });
    return Array.from(map.entries()).map(([model, d]) => {
      const avg = d.scores.length ? d.scores.reduce((a, b) => a + b, 0) / d.scores.length : 0;
      return { model, count: analyses.filter(r => getModelFromResult(r) === model).length,
        avgScore: Math.round(avg * 10) / 10, hookDistribution: d.hooks, topPlatforms: [] };
    }).sort((a, b) => b.count - a.count);
  }, [analyses]);

  const overallStats = useMemo(() => {
    const scores = analyses.map(getScore).filter(Boolean) as number[];
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      total: analyses.length,
      avgScore: Math.round(avg * 10) / 10,
      bestModel: modelStats[0]?.model || "—",
      viralHooks: analyses.filter(a => a.hook_strength === "viral").length,
    };
  }, [analyses, modelStats]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-6 w-6 animate-spin text-white/40" />
    </div>
  );

  return (
    <div className="p-5 lg:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Brain className="h-5 w-5 text-violet-400" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white" style={syne}>Intelligence</h1>
              {aiProfile?.creative_style && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-400 font-bold hidden sm:inline" style={mono}>
                  {String(aiProfile.creative_style)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/45">
              {overallStats.total} analyses · {imports.length} platform imports · {memoryData.length} memory signals
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={rebuildProfile} disabled={rebuilding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
            style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa" }}>
            <RefreshCw className={`h-3 w-3 ${rebuilding ? "animate-spin" : ""}`} />
            {rebuilding ? "Rebuilding..." : "Rebuild profile"}
          </button>
          <button onClick={loadData}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-white/45 hover:text-white transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.06)" }}>
        {([
          { id: "creative" as const, label: "Creative Intelligence", icon: Brain, badge: undefined as string | undefined },
          { id: "platform" as const, label: "Platform Data", icon: BarChart3, badge: imports.length > 0 ? String(imports.length) : undefined },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={activeTab === tab.id
              ? { background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }
              : { color: "rgba(255,255,255,0.35)", border: "1px solid transparent" }}>
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: "rgba(167,139,250,0.2)", color: "#a78bfa" }}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Creative Intelligence tab ── */}
      {activeTab === "creative" && (
        <div className="space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Analyses" value={overallStats.total} icon={BarChart3} color="#a78bfa" />
            <KpiCard label="Avg Hook Score" value={overallStats.avgScore > 0 ? `${overallStats.avgScore}/10` : "—"} icon={Target} color="#60a5fa" />
            <KpiCard label="Top Format" value={overallStats.bestModel} icon={Brain} color="#f472b6" />
            <KpiCard label="Viral Hooks" value={overallStats.viralHooks} icon={Zap} color="#fbbf24" />
          </div>

          {analyses.length === 0 && memoryData.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.13] py-16 text-center">
              <p className="text-3xl mb-3">🧠</p>
              <p className="text-white/40 text-sm font-semibold mb-1">No creative signals yet</p>
              <p className="text-white/40 text-xs">Run an analysis or generate hooks to build your creative intelligence profile</p>
            </div>
          ) : (
            <>
              {/* Model breakdown */}
              {modelStats.length > 0 && (
                <Section label="Creative Format Performance">
                  <div className="space-y-2">
                    {modelStats.map(stat => {
                      const meta = MODEL_LABELS[stat.model] || MODEL_LABELS["General"];
                      const maxCount = modelStats[0]?.count || 1;
                      return (
                        <div key={stat.model} className="rounded-2xl p-4 flex items-center gap-4 transition-all"
                          style={{ background: "#0a0a0d", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <span className="text-2xl shrink-0">{meta.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <p className="text-sm font-bold" style={{ color: meta.color }}>{stat.model}</p>
                              <div className="flex items-center gap-2">
                                {stat.avgScore > 0 && (
                                  <span className="text-xs font-bold" style={{
                                    ...mono,
                                    color: stat.avgScore >= 8 ? "#34d399" : stat.avgScore >= 6 ? "#fbbf24" : "#ffffff50"
                                  }}>
                                    {stat.avgScore}/10
                                  </span>
                                )}
                                <span className="text-[10px] text-white/45" style={mono}>{stat.count}x</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.max(4, (stat.count / maxCount) * 100)}%`, background: meta.color + "80" }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Memory signals */}
              {memoryData.length > 0 && (
                <Section label={`Creative Memory · ${memoryData.length} signals`}>
                  <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "#0a0a0d" }}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px" style={{ background: "rgba(255,255,255,0.05)" }}>
                      {(() => {
                        const byType: Record<string, { count: number; total: number }> = {};
                        memoryData.forEach(m => {
                          const t = m.hook_type || "general";
                          if (!byType[t]) byType[t] = { count: 0, total: 0 };
                          byType[t].count++;
                          byType[t].total += m.hook_score || 0;
                        });
                        return Object.entries(byType).sort((a, b) => b[1].count - a[1].count).slice(0, 4).map(([type, s]) => (
                          <div key={type} className="p-4" style={{ background: "#0a0a0d" }}>
                            <p className="text-[10px] text-white/45 uppercase tracking-wider truncate mb-1" style={mono}>{type}</p>
                            <p className="text-xl font-bold text-white" style={mono}>{(s.total / s.count).toFixed(1)}</p>
                            <p className="text-[10px] text-white/40">{s.count} samples</p>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="p-4 space-y-1.5">
                      {memoryData.filter(m => m.notes).slice(0, 5).map((m, i) => (
                        <div key={i} className="flex items-start gap-2.5 py-1">
                          <span className="text-xs font-bold shrink-0 w-8" style={{
                            ...mono,
                            color: (m.hook_score || 0) >= 7 ? "#34d399" : (m.hook_score || 0) >= 5 ? "#fbbf24" : "#f87171"
                          }}>
                            {(m.hook_score || 0).toFixed(1)}
                          </span>
                          <p className="text-[11px] text-white/55 truncate flex-1">{m.notes}</p>
                          <span className="text-[10px] text-white/15 shrink-0 ml-auto">{m.platform}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>
              )}

              {/* AI profile */}
              <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.15)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-violet-400" />
                    <p className="text-sm font-semibold text-white">What the AI knows about you</p>
                  </div>
                  {aiProfile?.last_updated && (
                    <span className="text-[10px] text-white/40" style={mono}>
                      Updated {new Date(String(aiProfile.last_updated)).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {aiProfile?.creative_style && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2.5 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 font-bold" style={mono}>
                      {String(aiProfile.creative_style)}
                    </span>
                    {aiProfile.avg_hook_score && (
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-white/40 font-bold" style={mono}>
                        avg {String(aiProfile.avg_hook_score)}/10 hook score
                      </span>
                    )}
                  </div>
                )}

                {aiProfile?.ai_summary
                  ? <p className="text-xs text-white/50 leading-relaxed">{String(aiProfile.ai_summary)}</p>
                  : <p className="text-xs text-white/50 leading-relaxed">
                      Your AI profile builds automatically after each analysis. After 3+ analyses you'll see personalized format recommendations, hook patterns, and market insights here.
                    </p>}

                {/* Top signals */}
                {(aiProfile?.top_performing_models || aiProfile?.best_platforms || aiProfile?.best_markets) && (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Best formats", values: aiProfile?.top_performing_models as string[] },
                      { label: "Best platforms", values: aiProfile?.best_platforms as string[] },
                      { label: "Best markets", values: aiProfile?.best_markets as string[] },
                    ].filter(g => g.values?.length).map(group => (
                      <div key={group.label} className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1.5" style={mono}>{group.label}</p>
                        <div className="space-y-0.5">
                          {group.values.slice(0, 3).map((v, i) => (
                            <p key={i} className="text-[10px] text-white/50 truncate">{v}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {aiProfile?.ai_recommendations && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-white/40 mb-2" style={mono}>Personalized recommendations</p>
                    <ul className="space-y-1.5">
                      {(aiProfile.ai_recommendations as string[]).map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-white/40">
                          <span className="text-violet-400 shrink-0 mt-0.5">→</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Platform Data tab ── */}
      {activeTab === "platform" && (
        <div className="space-y-4">

          {/* Active persona indicator */}
          {selectedPersona && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}>
              <span className="text-base">{selectedPersona.avatar_emoji || "🎯"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-violet-400/70 font-semibold truncate">Persona: {selectedPersona.name}</p>
                <p className="text-[10px] text-white/45 truncate">{selectedPersona.headline}</p>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-bold" style={mono}>ACTIVE</span>
            </div>
          )}

          {/* Upload panel — always visible */}
          <AdsUploadPanel userId={user.id} onImported={loadData} personaContext={
            selectedPersona ? `Active Persona: ${selectedPersona.name} — ${selectedPersona.headline}. Pains: ${selectedPersona.pains?.join(", ")}. Desires: ${selectedPersona.desires?.join(", ")}. Best platforms: ${selectedPersona.best_platforms?.join(", ")}. Hook angles: ${selectedPersona.hook_angles?.join(", ")}. Language style: ${selectedPersona.language_style}` : undefined
          } />

          {/* Imports list */}
          {imports.length > 0 ? (
            <Section label={`${imports.length} import${imports.length > 1 ? "s" : ""} · sorted by date`}>
              <div className="space-y-3">
                {imports.map(imp => (
                  <ImportCard key={imp.id} imp={imp} onDelete={deleteImport} />
                ))}
              </div>
            </Section>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.13] py-12 text-center">
              <p className="text-3xl mb-3">📊</p>
              <p className="text-white/55 text-sm font-semibold mb-1">No platform data imported yet</p>
              <p className="text-white/40 text-xs max-w-xs mx-auto">
                Upload a CSV export from Meta, Google, or TikTok Ads and the AI will extract creative performance insights automatically.
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
