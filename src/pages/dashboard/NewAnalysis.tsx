import { useState, useRef } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Check, ArrowLeft, Loader2, Link as LinkIcon, BarChart3, X, Video } from "lucide-react";
import { extractAudioFromFile, needsExtraction, MAX_WHISPER_SIZE } from "@/lib/audioExtractor";
import PersonaGateModal from "@/components/PersonaGateModal";

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
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<ProgressStep>("idle");
  const [progress, setProgress] = useState(0);
  const [showPersonaGate, setShowPersonaGate] = useState(false);
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
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
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
      xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`);
      xhr.setRequestHeader("apikey", anonKey);
      xhr.send(formData);
    });
  };

  const startAnalysis = async () => {
    if (!file && !videoUrl.trim()) { toast.error("Upload a video or paste a URL"); return; }
    setStep("idle");
    setProgress(0);

    const { data: record, error: insertErr } = await supabase
      .from("analyses")
      .insert({ user_id: user.id, title: title || file?.name || "Untitled Analysis", video_url: videoUrl || null, status: "processing" })
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
            <BarChart3 className="h-5 w-5 text-purple-400" />
            <h1 className="text-lg font-bold text-white" style={{ ...syne, letterSpacing: "-0.02em" }}>New Analysis</h1>
          </div>
        </div>

        {showForm ? (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Title (optional)</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Nike Q1 — UGC Test"
                className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/20 text-sm outline-none focus:border-white/25 transition-colors" />
            </div>

            {/* Market */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-white/40 uppercase tracking-wider">Market</label>
                {selectedPersona && !marketOverridden && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa" }}>
                    via {selectedPersona.name.split(" ")[0]}
                  </span>
                )}
                {marketOverridden && (
                  <button onClick={() => { setMarket(personaMarket); setMarketOverridden(false); }}
                    className="text-[10px] text-white/30 hover:text-white/60 transition-colors underline">
                    Reset to persona
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {MARKETS.map(m => (
                  <button key={m.code} onClick={() => { setMarket(m.code); setMarketOverridden(true); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-all ${
                      market === m.code ? "border-purple-400/50 bg-purple-500/10 text-white" : "border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/15"
                    }`}>
                    <span>{m.flag}</span> {m.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div className={`rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
              isDragging ? "border-purple-400/60 bg-purple-500/10" : file ? "border-green-400/40 bg-green-500/5" : "border-white/[0.1] hover:border-white/20 hover:bg-white/[0.02]"
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
                  <button onClick={e => { e.stopPropagation(); setFile(null); }} className="h-8 w-8 rounded-xl flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 px-6">
                  <Upload className="h-8 w-8 text-white/20" />
                  <p className="text-white/50 text-sm font-medium">Drop video here or click to browse</p>
                  <p className="text-xs text-white/20">MP4, MOV, AVI — any size (audio auto-extracted if &gt;25MB)</p>
                </div>
              )}
            </div>

            {/* OR URL */}
            <div className="relative flex items-center">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="px-3 text-xs text-white/20 uppercase tracking-wider">or paste URL</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
              <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.tiktok.com/@brand/video/..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/20 text-sm outline-none focus:border-white/25 transition-colors" />
            </div>

            <button
              onClick={() => { if (!selectedPersona) { setShowPersonaGate(true); } else { startAnalysis(); } }}
              disabled={!file && !videoUrl.trim()}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Start Analysis
            </button>

            {!selectedPersona && (
              <p className="text-center text-[11px] text-white/25 -mt-1">
                💡{" "}
                <button onClick={() => setShowPersonaGate(true)} className="text-purple-400/70 hover:text-purple-400 underline transition-colors">
                  Ative uma persona
                </button>{" "}
                para resultados mais precisos
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 space-y-6">
            <div className="text-center">
              {step === "done" ? (
                <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                  <Check className="h-6 w-6 text-green-400" />
                </div>
              ) : (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-400 mb-3" />
              )}
              <h3 className="text-lg font-semibold text-white" style={syne}>
                {step === "done" ? "Analysis complete!" : "Analyzing your video..."}
              </h3>
              {step !== "done" && <p className="text-sm text-white/30 mt-1">Usually takes 30–60 seconds</p>}
            </div>

            <div className="space-y-3">
              {STEP_ORDER.slice(0, -1).map((s, i) => {
                const stepIdx = STEP_ORDER.indexOf(step);
                const isDone = stepIdx > i;
                const isActive = stepIdx === i;
                return (
                  <div key={s} className={`flex items-center gap-3 transition-all duration-300 ${isDone || isActive ? "text-white" : "text-white/20"}`}>
                    {isDone ? <Check className="h-4 w-4 text-green-400 shrink-0" /> : isActive ? (
                      <div className="h-4 w-4 shrink-0 flex items-center justify-center"><div className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" /></div>
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
                style={{ width: `${overallProgress}%`, background: step === "done" ? "#34d399" : "linear-gradient(90deg, #a78bfa, #f472b6)" }} />
            </div>
            <p className="text-xs text-white/20 text-center font-mono">{overallProgress}%</p>
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
