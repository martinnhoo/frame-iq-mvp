import { useState, useRef } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";
import { Upload, Check, ArrowLeft, Loader2, Link as LinkIcon, BarChart3, X, Video, FileSpreadsheet, ChevronDown } from "lucide-react";
import { extractAudioFromFile, needsExtraction, MAX_WHISPER_SIZE } from "@/lib/audioExtractor";
import PersonaGateModal from "@/components/PersonaGateModal";

// ── CSV Meta Ads Parser ──────────────────────────────────────────────────────
interface MetaAdRow {
  adName: string;
  ctr?: string; roas?: string; spend?: string; impressions?: string;
  cpc?: string; cpp?: string; reach?: string; frequency?: string;
  videoPlays?: string; video25?: string; video50?: string; video75?: string; video100?: string;
  conversions?: string; costPerResult?: string;
}

function parseMetaCSV(text: string): MetaAdRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim().toLowerCase());
  const findCol = (...names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));
  const adNameIdx = findCol("ad name", "nome do anúncio", "nombre del anuncio");
  if (adNameIdx === -1) return [];
  const ctrIdx = findCol("ctr"); const roasIdx = findCol("roas");
  const spendIdx = findCol("amount spent", "valor gasto", "gasto", "spend");
  const impIdx = findCol("impressions", "impressões");
  const cpcIdx = findCol("cpc"); const cppIdx = findCol("cpp");
  const reachIdx = findCol("reach", "alcance"); const freqIdx = findCol("frequency", "frequência");
  const vp = findCol("video plays", "reproduções de vídeo", "video views");
  const v25 = findCol("25%", "video watched at 25");
  const v50 = findCol("50%", "video watched at 50");
  const v75 = findCol("75%", "video watched at 75");
  const v100 = findCol("100%", "video watched at 100");
  const convIdx = findCol("results", "conversions", "resultados");
  const cprIdx = findCol("cost per result", "custo por resultado");

  const get = (row: string[], idx: number) => idx >= 0 ? (row[idx] || "").replace(/"/g, "").trim() : undefined;

  return lines.slice(1).map(line => {
    const cols = line.split(",");
    return {
      adName: get(cols, adNameIdx) || "",
      ctr: get(cols, ctrIdx), roas: get(cols, roasIdx), spend: get(cols, spendIdx),
      impressions: get(cols, impIdx), cpc: get(cols, cpcIdx), cpp: get(cols, cppIdx),
      reach: get(cols, reachIdx), frequency: get(cols, freqIdx),
      videoPlays: get(cols, vp), video25: get(cols, v25), video50: get(cols, v50),
      video75: get(cols, v75), video100: get(cols, v100),
      conversions: get(cols, convIdx), costPerResult: get(cols, cprIdx),
    };
  }).filter(r => r.adName);
}

function fuzzyMatch(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = norm(a); const nb = norm(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  // token overlap
  const ta = new Set(na.split(/\s+/)); const tb = new Set(nb.split(/\s+/));
  const inter = [...ta].filter(t => tb.has(t)).length;
  return inter / Math.max(ta.size, tb.size, 1);
}

function formatMetaData(row: MetaAdRow): string {
  const parts: string[] = [];
  if (row.ctr) parts.push(`CTR: ${row.ctr}%`);
  if (row.roas) parts.push(`ROAS: ${row.roas}x`);
  if (row.spend) parts.push(`Spend: $${row.spend}`);
  if (row.impressions) parts.push(`Impressions: ${row.impressions}`);
  if (row.cpc) parts.push(`CPC: $${row.cpc}`);
  if (row.reach) parts.push(`Reach: ${row.reach}`);
  if (row.frequency) parts.push(`Frequency: ${row.frequency}`);
  if (row.videoPlays) parts.push(`Video plays: ${row.videoPlays}`);
  if (row.video25) parts.push(`Watched 25%: ${row.video25}`);
  if (row.video50) parts.push(`Watched 50%: ${row.video50}`);
  if (row.video75) parts.push(`Watched 75%: ${row.video75}`);
  if (row.video100) parts.push(`Watched 100%: ${row.video100}`);
  if (row.conversions) parts.push(`Results: ${row.conversions}`);
  if (row.costPerResult) parts.push(`Cost/result: $${row.costPerResult}`);
  return parts.join(" | ");
}

type ProgressStep = "idle" | "extracting" | "uploading" | "transcribing" | "analyzing" | "done" | "error";

const STEP_LABELS: Record<ProgressStep, string> = {
  idle: "", extracting: "Compressing & extracting audio...", uploading: "Uploading...",
  transcribing: "Transcribing with Whisper...", analyzing: "AI analyzing creative...",
  done: "Done!", error: "Failed",
};

const STEP_ORDER: ProgressStep[] = ["extracting", "uploading", "transcribing", "analyzing", "done"];

const MARKETS = [
  { code: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "MX", flag: "🇲🇽", name: "Mexico" },
  { code: "US", flag: "🇺🇸", name: "United States" },
  { code: "IN", flag: "🇮🇳", name: "India" },
  { code: "FR", flag: "🇫🇷", name: "France" },
  { code: "DE", flag: "🇩🇪", name: "Germany" },
  { code: "IT", flag: "🇮🇹", name: "Italy" },
  { code: "AE", flag: "🇸🇦", name: "Arabia" },
];

function detectMarketFromPersona(style: string): string {
  if (!style) return "US";
  const s = style.toLowerCase();
  if (s.includes("portug") || s.includes("brasil")) return "BR";
  if (s.includes("espanh") || s.includes("español") || s.includes("spanish")) return "MX";
  if (s.includes("hindi")) return "IN";
  if (s.includes("french") || s.includes("françai")) return "FR";
  if (s.includes("german") || s.includes("deutsch")) return "DE";
  if (s.includes("italian")) return "IT";
  if (s.includes("arabic") || s.includes("árabe")) return "AE";
  return "US";
}

const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;

const NewAnalysis = () => {
  const { user, refreshUsage, selectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const dt = useDashT(language);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<ProgressStep>("idle");
  const [progress, setProgress] = useState(0);
  const [showPersonaGate, setShowPersonaGate] = useState(false);

  // ── CSV enrichment state ─────────────────────────────────────────────────
  const [csvRows, setCsvRows] = useState<MetaAdRow[]>([]);
  const [matchedRow, setMatchedRow] = useState<MetaAdRow | null>(null);
  const [csvLoaded, setCsvLoaded] = useState(false);
  const [showCsvPicker, setShowCsvPicker] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  const handleCsvFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseMetaCSV(text);
      setCsvRows(rows);
      setCsvLoaded(true);
      setShowCsvPicker(false);
      // Auto-match against current title or file name
      const name = title || file?.name?.replace(/\.[^/.]+$/, "") || "";
      if (name && rows.length > 0) {
        const scored = rows.map(r => ({ r, score: fuzzyMatch(name, r.adName) })).sort((a, b) => b.score - a.score);
        if (scored[0].score > 0.4) setMatchedRow(scored[0].r);
      }
    };
    reader.readAsText(f);
  };

  // When title changes, try to re-match
  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (csvRows.length > 0 && v) {
      const scored = csvRows.map(r => ({ r, score: fuzzyMatch(v, r.adName) })).sort((a, b) => b.score - a.score);
      if (scored[0].score > 0.4) setMatchedRow(scored[0].r);
    }
  };
  const fileRef = useRef<HTMLInputElement>(null);

  const personaMarket = selectedPersona ? detectMarketFromPersona(selectedPersona.language_style) : "US";
  const [market, setMarket] = useState(personaMarket);
  const [marketOverridden, setMarketOverridden] = useState(false);
  const [prevPersonaMarket, setPrevPersonaMarket] = useState(personaMarket);

  if (personaMarket !== prevPersonaMarket) {
    setPrevPersonaMarket(personaMarket);
    if (!marketOverridden) setMarket(personaMarket);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("video/")) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
    } else {
      toast.error("Please drop a video file");
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const doExtractAudio = async (videoFile: File): Promise<File> => {
    setStep("extracting");
    setProgress(10);
    const wavFile = await extractAudioFromFile(videoFile, (p) => {
      setProgress(p.percent);
    });
    return wavFile;
  };

  const uploadWithProgress = (formData: FormData): Promise<any> => {
    return new Promise(async (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      // Use session token, not anon key — functions require authenticated user
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error("Invalid server response")); }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.timeout = 180000;
      xhr.ontimeout = () => reject(new Error("Upload timed out"));
      xhr.open("POST", `https://${projectId}.supabase.co/functions/v1/analyze-video`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
      xhr.send(formData);
    });
  };

  const startAnalysis = async () => {
    if (!file && !videoUrl.trim()) { toast.error("Upload a video or paste a URL"); return; }
    setStep("idle");
    setProgress(0);

    const { data: record, error: insertErr } = await supabase
      .from("analyses")
      .insert({ user_id: user.id, persona_id: selectedPersona?.id || null, title: title || file?.name || "Untitled Analysis", video_url: videoUrl || null, status: "processing" })
      .select().single();

    if (insertErr || !record) { toast.error("Failed to create analysis"); return; }

    let fileToSend = file;

    if (file && needsExtraction(file)) {
      try {
        fileToSend = await doExtractAudio(file);
        if (fileToSend.size > MAX_WHISPER_SIZE) {
          toast.error(`Audio too large (${(fileToSend.size / 1024 / 1024).toFixed(1)}MB). Try a shorter video.`);
          setStep("error");
          await supabase.from("analyses").update({ status: "failed" }).eq("id", record.id);
          return;
        }
      } catch (err: any) {
        toast.error(err.message || "Could not extract audio");
        setStep("error");
        await supabase.from("analyses").update({ status: "failed" }).eq("id", record.id);
        return;
      }
    }

    setStep("uploading");
    setProgress(0);

    try {
      const formData = new FormData();
      if (fileToSend) formData.append("video_file", fileToSend);
      if (videoUrl) formData.append("video_url", videoUrl);
      formData.append("market", market);
      formData.append("user_id", user.id);
      formData.append("analysis_id", record.id);
      formData.append("title", title || file?.name || "Untitled");
      // Inject Meta performance data if available
      if (matchedRow) {
        formData.append("meta_performance_data", formatMetaData(matchedRow));
        formData.append("meta_ad_name", matchedRow.adName);
      }

      const data = await uploadWithProgress(formData);

      if (data?.error) {
        await supabase.from("analyses").update({ status: "failed" }).eq("id", record.id);
        toast.error(data?.message || data?.error || "Analysis failed");
        setStep("error");
        setTimeout(() => navigate(`/dashboard/analyses/${record.id}`), 1000);
        return;
      }

      setStep("done");
      setProgress(100);
      refreshUsage();
      toast.success("Analysis complete!");
      // Auto-trigger learn — closes the loop after each new analysis
      supabase.functions.invoke("creative-loop", {
        body: { action: "learn", user_id: user.id }
      }).catch(() => {}); // fire and forget
      setTimeout(() => navigate(`/dashboard/analyses/${record.id}`), 800);
    } catch (err: any) {
      toast.error(err.message || "Unexpected error");
      await supabase.from("analyses").update({ status: "failed" }).eq("id", record.id);
      setStep("error");
      setTimeout(() => navigate(`/dashboard/analyses/${record.id}`), 1500);
    }
  };

  const overallProgress = (() => {
    const stepIdx = STEP_ORDER.indexOf(step);
    if (stepIdx < 0) return 0;
    if (step === "done") return 100;
    const stepWeight = 100 / (STEP_ORDER.length - 1);
    return Math.round(stepIdx * stepWeight + (progress / 100) * stepWeight);
  })();

  const showForm = step === "idle" || step === "error";

  return (
    <>
      <div className="page-enter p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard/analyses")} className="h-8 w-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-sky-400" />
            <h1 className="text-lg font-bold text-white" style={{ ...syne, letterSpacing: "-0.02em" }}>New Analysis</h1>
          </div>
        </div>

        {showForm ? (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Title (optional)</label>
              <input value={title} onChange={e => handleTitleChange(e.target.value)} placeholder="e.g. Nike Q1 — UGC Test"
                className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/40 text-sm outline-none focus:border-white/25 transition-colors" />
            </div>

            {/* CSV Enrichment */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/40 uppercase tracking-wider">Meta Ads Data <span className="normal-case text-white/25">(optional — enriches analysis with real CTR, ROAS, retention)</span></label>
              </div>

              {!csvLoaded ? (
                <div
                  className="w-full rounded-2xl border border-dashed border-white/[0.1] text-center cursor-pointer transition-all hover:border-sky-500/40 hover:bg-sky-500/[0.03]"
                  style={{ padding: "14px 16px" }}
                  onClick={() => csvRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCsvFile(f); }}>
                  <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }} />
                  <div className="flex items-center justify-center gap-2">
                    <FileSpreadsheet size={14} className="text-white/30" />
                    <span className="text-xs text-white/30">Drop your Meta Ads CSV here or <span className="text-sky-400/70">browse</span></span>
                  </div>
                  <p className="text-[10px] text-white/15 mt-1">Export from Meta Ads Manager → Reports → Ads level → Export CSV</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "rgba(14,165,233,0.06)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <FileSpreadsheet size={13} className="text-sky-400" />
                    <span className="text-xs font-semibold text-sky-400">{csvRows.length} ads found in CSV</span>
                    <button onClick={() => { setCsvLoaded(false); setCsvRows([]); setMatchedRow(null); }}
                      className="ml-auto text-white/20 hover:text-white/50 transition-colors">
                      <X size={13} />
                    </button>
                  </div>

                  {/* Match result */}
                  {matchedRow ? (
                    <div className="px-4 py-3">
                      <div className="flex items-start gap-2 mb-2">
                        <Check size={13} className="text-green-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-green-400 mb-0.5">Auto-matched: <span className="text-white/60 font-normal truncate">{matchedRow.adName}</span></p>
                          <p className="text-[11px] text-white/30 leading-relaxed">
                            {[matchedRow.ctr && `CTR ${matchedRow.ctr}%`, matchedRow.roas && `ROAS ${matchedRow.roas}x`, matchedRow.spend && `$${matchedRow.spend} spent`, matchedRow.video25 && `25% retention: ${matchedRow.video25}`].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setShowCsvPicker(!showCsvPicker)}
                        className="text-[11px] text-white/30 hover:text-white/50 flex items-center gap-1 transition-colors">
                        Wrong match? Pick manually <ChevronDown size={11} />
                      </button>
                    </div>
                  ) : (
                    <div className="px-4 py-3">
                      <p className="text-xs text-white/40 mb-2">No automatic match found. Select the right ad:</p>
                    </div>
                  )}

                  {/* Manual picker */}
                  {(!matchedRow || showCsvPicker) && (
                    <div className="max-h-40 overflow-y-auto" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      {csvRows.map((row, i) => (
                        <button key={i} onClick={() => { setMatchedRow(row); setShowCsvPicker(false); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0">
                          <p className="text-xs text-white/70 truncate">{row.adName}</p>
                          <p className="text-[10px] text-white/25 mt-0.5">
                            {[row.ctr && `CTR ${row.ctr}%`, row.roas && `ROAS ${row.roas}x`, row.spend && `$${row.spend}`].filter(Boolean).join(" · ")}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Market */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-white/40 uppercase tracking-wider">Market</label>
                {selectedPersona && !marketOverridden && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.25)", color: "#0ea5e9" }}>
                    via {selectedPersona.name.split(" ")[0]}
                  </span>
                )}
                {marketOverridden && (
                  <button onClick={() => { setMarket(personaMarket); setMarketOverridden(false); }}
                    className="text-[10px] text-white/50 hover:text-white/60 transition-colors underline">
                    Reset to persona
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {MARKETS.map(m => (
                  <button key={m.code} onClick={() => { setMarket(m.code); setMarketOverridden(true); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-all ${
                      market === m.code ? "border-sky-400/50 bg-sky-500/10 text-white" : "border-white/[0.15] text-white/40 hover:text-white/70 hover:border-white/15"
                    }`}>
                    <span>{m.flag}</span> {m.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div className={`rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
              isDragging ? "border-sky-400/60 bg-sky-500/10" : file ? "border-green-400/40 bg-green-500/5" : "border-white/[0.1] hover:border-white/20 hover:bg-white/[0.06]"
            }`} onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onClick={() => !file && fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept="video/*" onChange={handleFileInput} className="hidden" />
              {file ? (
                <div className="flex items-center gap-4 p-5">
                  <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: needsExtraction(file) ? "rgba(251,191,36,0.15)" : "rgba(52,211,153,0.15)" }}>
                    <Video className="h-6 w-6" style={{ color: needsExtraction(file) ? "#fbbf24" : "#34d399" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{file.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: needsExtraction(file) ? "#fbbf24" : "rgba(255,255,255,0.3)" }}>
                      {(file.size / (1024 * 1024)).toFixed(1)} MB{needsExtraction(file) && " · ⚡ Audio will be extracted automatically"}
                    </p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setFile(null); }} className="h-8 w-8 rounded-xl flex items-center justify-center text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-all">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 px-6">
                  <Upload className="h-8 w-8 text-white/40" />
                  <p className="text-white/50 text-sm font-medium">Drop video here or click to browse</p>
                  <p className="text-xs text-white/40">MP4, MOV, AVI — any size (audio auto-extracted if &gt;25MB)</p>
                </div>
              )}
            </div>

            {/* OR URL */}
            <div className="relative flex items-center">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="px-3 text-xs text-white/40 uppercase tracking-wider">or paste URL</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.tiktok.com/@brand/video/..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/40 text-sm outline-none focus:border-white/25 transition-colors" />
            </div>

            <button
              onClick={() => { if (!selectedPersona) { setShowPersonaGate(true); } else { startAnalysis(); } }}
              disabled={!file && !videoUrl.trim()}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Start Analysis
            </button>

            {!selectedPersona && (
              <p className="text-center text-[11px] text-white/45 -mt-1">
                💡{" "}
                <button onClick={() => setShowPersonaGate(true)} className="text-sky-400/70 hover:text-sky-400 underline transition-colors">
                  Ative uma persona
                </button>{" "}
                para resultados mais precisos
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.15] bg-white/[0.06] p-8 space-y-6">
            <div className="text-center">
              {step === "done" ? (
                <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                  <Check className="h-6 w-6 text-green-400" />
                </div>
              ) : (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-sky-400 mb-3" />
              )}
              <h3 className="text-lg font-semibold text-white" style={syne}>
                {step === "done" ? "Analysis complete!" : "Analyzing your video..."}
              </h3>
              {step !== "done" && <p className="text-sm text-white/50 mt-1">Usually takes 30–60 seconds</p>}
            </div>

            <div className="space-y-3">
              {STEP_ORDER.slice(0, -1).map((s, i) => {
                const stepIdx = STEP_ORDER.indexOf(step);
                const isDone = stepIdx > i;
                const isActive = stepIdx === i;
                return (
                  <div key={s} className={`flex items-center gap-3 transition-all duration-300 ${isDone || isActive ? "text-white" : "text-white/40"}`}>
                    {isDone ? <Check className="h-4 w-4 text-green-400 shrink-0" /> : isActive ? (
                      <div className="h-4 w-4 shrink-0 flex items-center justify-center"><div className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" /></div>
                    ) : (
                      <div className="h-4 w-4 shrink-0 flex items-center justify-center"><div className="h-1.5 w-1.5 rounded-full bg-white/10" /></div>
                    )}
                    <span className="text-sm">{STEP_LABELS[s]}</span>
                  </div>
                );
              })}
            </div>

            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%`, background: step === "done" ? "#34d399" : "linear-gradient(90deg, #0ea5e9, #06b6d4)" }} />
            </div>
            <p className="text-xs text-white/40 text-center font-mono">{overallProgress}%</p>
          </div>
        )}
      </div>

      <PersonaGateModal
        open={showPersonaGate}
        onClose={() => {
          setShowPersonaGate(false);
          if (file || videoUrl.trim()) startAnalysis();
        }}
        intent="analysis"
      />
    </>
  );
};

export default NewAnalysis;

// force-sync 2026-03-24T23:23:48Z