import { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Check, ArrowLeft, Loader2, Link as LinkIcon, BarChart3 } from "lucide-react";

const STEPS = [
  "Uploading video...",
  "Extracting audio...",
  "Transcribing with Whisper...",
  "Analyzing creative model...",
  "Scoring hook strength...",
  "Generating insights...",
];

const MARKETS = [
  { code: "GLOBAL", flag: "🌍", name: "Global" },
  { code: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "MX", flag: "🇲🇽", name: "Mexico" },
  { code: "US", flag: "🇺🇸", name: "United States" },
  { code: "IN", flag: "🇮🇳", name: "India" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom" },
  { code: "ES", flag: "🇪🇸", name: "Spain" },
  { code: "AR", flag: "🇦🇷", name: "Argentina" },
];

const NewAnalysis = () => {
  const { user, refreshUsage } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [market, setMarket] = useState("GLOBAL");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);

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

  const startAnalysis = async () => {
    if (!file && !videoUrl.trim()) {
      toast.error("Upload a video or paste a URL");
      return;
    }

    setIsProcessing(true);
    setActiveStep(0);

    // 1. Create analysis record first
    const { data: record, error: insertErr } = await supabase
      .from("analyses")
      .insert({
        user_id: user.id,
        title: title || file?.name || "Untitled Analysis",
        video_url: videoUrl || null,
        status: "processing",
      })
      .select()
      .single();

    if (insertErr || !record) {
      toast.error("Failed to create analysis");
      setIsProcessing(false);
      return;
    }

    // Animate steps while processing
    let step = 0;
    const interval = setInterval(() => {
      step = Math.min(step + 1, STEPS.length - 2);
      setActiveStep(step);
    }, 3500);

    try {
      // 2. Call edge function
      const formData = new FormData();
      if (file) formData.append("video_file", file);
      if (videoUrl) formData.append("video_url", videoUrl);
      formData.append("market", market);
      formData.append("user_id", user.id);
      formData.append("analysis_id", record.id);
      formData.append("title", title || file?.name || "Untitled");

      const { data, error } = await supabase.functions.invoke("analyze-video", {
        body: formData,
      });

      clearInterval(interval);

      if (error || data?.error) {
        const msg = data?.message || error?.message || "Analysis failed";
        // Update record to failed
        await supabase.from("analyses").update({ status: "failed" }).eq("id", record.id);
        toast.error(msg);
        setIsProcessing(false);
        navigate(`/dashboard/analyses/${record.id}`);
        return;
      }

      setActiveStep(STEPS.length - 1);
      refreshUsage();
      toast.success("Analysis complete!");

      setTimeout(() => {
        navigate(`/dashboard/analyses/${record.id}`);
      }, 800);

    } catch (err) {
      clearInterval(interval);
      toast.error("Unexpected error — check Supabase logs");
      await supabase.from("analyses").update({ status: "failed" }).eq("id", record.id);
      setIsProcessing(false);
      navigate(`/dashboard/analyses/${record.id}`);
    }
  };

  const pct = Math.round(((activeStep + 1) / STEPS.length) * 100);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard/analyses")}
          className="h-8 w-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-purple-400" />
          <h1 className="text-lg font-bold text-white">New Analysis</h1>
        </div>
      </div>

      {!isProcessing ? (
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Title (optional)</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Nike Q1 — UGC Test"
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/20 text-sm outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {/* Market */}
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Market</label>
            <div className="flex flex-wrap gap-2">
              {MARKETS.map(m => (
                <button
                  key={m.code}
                  onClick={() => setMarket(m.code)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-all ${
                    market === m.code
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/15"
                  }`}
                >
                  <span>{m.flag}</span> {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div
            className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 cursor-pointer ${
              isDragging ? "border-purple-400/60 bg-purple-500/10" :
              file ? "border-green-400/40 bg-green-500/5" :
              "border-white/[0.1] hover:border-white/20 hover:bg-white/[0.02]"
            }`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !file && document.getElementById("fileInput")?.click()}
          >
            <input id="fileInput" type="file" accept="video/*" onChange={handleFileInput} className="hidden" />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-400" />
                </div>
                <p className="font-medium text-white text-sm">{file.name}</p>
                <p className="text-xs text-white/30">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                <button
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                  className="text-xs text-white/25 hover:text-white/50 mt-1 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="h-8 w-8 text-white/20" />
                <p className="text-white/50 text-sm font-medium">Drop video here or click to browse</p>
                <p className="text-xs text-white/20">MP4, MOV, AVI — up to 500MB</p>
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
            <input
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@brand/video/..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/20 text-sm outline-none focus:border-white/25 transition-colors"
            />
          </div>

          <button
            onClick={startAnalysis}
            disabled={!file && !videoUrl.trim()}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Start Analysis
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 space-y-6">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-400 mb-3" />
            <h3 className="text-lg font-semibold text-white">Analyzing your video...</h3>
            <p className="text-sm text-white/30 mt-1">Usually takes 30–60 seconds</p>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {STEPS.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${
                i <= activeStep ? "text-white" : "text-white/20"
              }`}>
                {i < activeStep ? (
                  <Check className="h-4 w-4 text-green-400 shrink-0" />
                ) : i === activeStep ? (
                  <div className="h-4 w-4 shrink-0 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                  </div>
                ) : (
                  <div className="h-4 w-4 shrink-0 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                  </div>
                )}
                <span className="text-sm">{step}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-white/20 text-center font-mono">{pct}%</p>
        </div>
      )}
    </div>
  );
};

export default NewAnalysis;
