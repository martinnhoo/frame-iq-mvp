import { useState, useCallback, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Copy, Check, Video, X, ChevronDown, Loader2, Sparkles, Mic, FileText, Wand2, Languages, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";

const LANGUAGES = [
  { code: "en", flag: "🇺🇸", name: "English",    market: "US / Global" },
  { code: "pt", flag: "🇧🇷", name: "Português",  market: "Brazil" },
  { code: "es", flag: "🇪🇸", name: "Español",    market: "MX / LATAM" },
  { code: "hi", flag: "🇮🇳", name: "Hindi",      market: "India" },
  { code: "fr", flag: "🇫🇷", name: "Français",   market: "France / CA" },
  { code: "de", flag: "🇩🇪", name: "Deutsch",    market: "Germany" },
  { code: "it", flag: "🇮🇹", name: "Italiano",   market: "Italy" },
  { code: "ar", flag: "🇸🇦", name: "عربي",       market: "MENA" },
  { code: "zh", flag: "🇨🇳", name: "中文",        market: "China / TW" },
  { code: "ja", flag: "🇯🇵", name: "日本語",      market: "Japan" },
  { code: "ko", flag: "🇰🇷", name: "한국어",      market: "Korea" },
  { code: "tr", flag: "🇹🇷", name: "Türkçe",     market: "Turkey" },
  { code: "ru", flag: "🇷🇺", name: "Русский",    market: "Russia / CIS" },
  { code: "nl", flag: "🇳🇱", name: "Nederlands", market: "Netherlands" },
  { code: "pl", flag: "🇵🇱", name: "Polski",     market: "Poland" },
  { code: "th", flag: "🇹🇭", name: "ภาษาไทย",    market: "Thailand" },
  { code: "id", flag: "🇮🇩", name: "Bahasa",     market: "Indonesia" },
  { code: "vi", flag: "🇻🇳", name: "Tiếng Việt", market: "Vietnam" },
];

const TONES = [
  { id: "Aggressive / Urgent", label: "🔥 Urgent" },
  { id: "Conversational",      label: "💬 Casual" },
  { id: "Professional",        label: "💼 Pro" },
  { id: "Playful",             label: "✨ Playful" },
  { id: "Emotional",           label: "❤️ Emotional" },
];

const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const mono = { fontFamily: "'DM Mono', monospace" } as const;

const LangPill = ({ value, onChange, exclude = [] }: { value: string; onChange: (c: string) => void; exclude?: string[] }) => {
  const [open, setOpen] = useState(false);
  const lang = LANGUAGES.find(l => l.code === value) || LANGUAGES[0];
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-sm"
        style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "#fff" }}>
        <span className="text-lg">{lang.flag}</span>
        <span className="font-semibold">{lang.name}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-40" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 rounded-2xl border border-white/10 shadow-2xl p-2 w-60 max-h-72 overflow-y-auto" style={{ background: "#0d0d0d" }}>
            {LANGUAGES.filter(l => !exclude.includes(l.code)).map(l => (
              <button key={l.code} onClick={() => { onChange(l.code); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${l.code === value ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/[0.06]"}`}>
                <span className="text-lg">{l.flag}</span>
                <span className="flex-1 text-left font-medium">{l.name}</span>
                <span className="text-[10px] text-white/25">{l.market}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Mode A: Transcribe + Translate ──────────────────────────────────────────
const TranscribeMode = ({ userId }: { userId: string }) => {
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState("en");
  const [transcribing, setTranscribing] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState("");
  const [transcript, setTranscript] = useState("");
  const [translated, setTranslated] = useState("");
  const [copiedT, setCopiedT] = useState(false);
  const [copiedTr, setCopiedTr] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const acceptFile = (f: File) => {
    if (!f.type.startsWith("video/") && !f.type.startsWith("audio/")) {
      toast.error("Please drop a video or audio file");
      return;
    }
    setFile(f);
    setTranscript("");
    setTranslated("");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files[0]) acceptFile(e.dataTransfer.files[0]);
  }, []);

  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB — Whisper API limit

  /** Extract audio from video using browser APIs to reduce file size */
  const extractAudio = async (videoFile: File): Promise<File> => {
    setCompressing(true);
    setCompressProgress("Loading video...");

    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(videoFile);
      video.src = url;

      video.onloadedmetadata = () => {
        setCompressProgress("Extracting audio...");
        
        // Create audio context and media element source
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);

        // Use MediaRecorder to capture audio only
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/mp4";
        
        const recorder = new MediaRecorder(dest.stream, { mimeType, audioBitsPerSecond: 64000 });
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        recorder.onstop = () => {
          URL.revokeObjectURL(url);
          audioCtx.close();
          const blob = new Blob(chunks, { type: mimeType });
          const ext = mimeType.includes("webm") ? "webm" : "mp4";
          const audioFile = new File([blob], `audio.${ext}`, { type: mimeType });
          setCompressing(false);
          setCompressProgress("");
          resolve(audioFile);
        };

        recorder.onerror = () => {
          URL.revokeObjectURL(url);
          audioCtx.close();
          setCompressing(false);
          reject(new Error("Audio extraction failed"));
        };

        const duration = video.duration;
        let lastProgress = 0;

        video.ontimeupdate = () => {
          const pct = Math.min(99, Math.round((video.currentTime / duration) * 100));
          if (pct > lastProgress) {
            lastProgress = pct;
            setCompressProgress(`Extracting audio... ${pct}%`);
          }
        };

        recorder.start(1000);
        video.playbackRate = 16; // Speed up extraction
        video.play().catch(reject);

        video.onended = () => { recorder.stop(); };
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        setCompressing(false);
        reject(new Error("Could not load video"));
      };
    });
  };

  const handleRun = async () => {
    if (!file) return;

    let fileToSend = file;

    // If file is too large and is a video, extract audio
    if (file.size > MAX_FILE_SIZE && file.type.startsWith("video/")) {
      try {
        toast.info("File too large for Whisper. Extracting audio track...");
        fileToSend = await extractAudio(file);
        const newSizeMB = (fileToSend.size / 1024 / 1024).toFixed(1);
        toast.success(`Audio extracted: ${newSizeMB}MB`);
        
        // If still too large after extraction
        if (fileToSend.size > MAX_FILE_SIZE) {
          toast.error(`Audio still too large (${newSizeMB}MB). Try a shorter video.`);
          return;
        }
      } catch (err) {
        console.error("Audio extraction error:", err);
        toast.error("Could not extract audio. Try a smaller file or convert to MP3 first.");
        return;
      }
    } else if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Max 25MB for audio files.`);
      return;
    }

    setTranscribing(true);
    setTranscript("");
    setTranslated("");
    try {
      // Send actual file as FormData for Whisper transcription
      const formData = new FormData();
      formData.append("video_file", file);
      formData.append("user_id", userId || "");
      formData.append("transcribe_only", "true");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/analyze-video`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
          body: formData,
        }
      );
      const data = await res.json();
      console.log('Transcription response:', data);
      if (data?.error) {
        toast.error(data.message || "Transcription failed");
        setTranscript("");
        setTranscribing(false);
        return;
      }
      const rawTranscript = data?.transcript || "";
      if (!rawTranscript) {
        toast.error("No transcript returned");
        setTranscribing(false);
        return;
      }
      setTranscript(rawTranscript);
      if (targetLang !== "en" && !rawTranscript.includes("failed") && !rawTranscript.includes("error")) {
        const lang = LANGUAGES.find(l => l.code === targetLang)!;
        const { data: tData } = await supabase.functions.invoke("translate-text", {
          body: {
            source_text: rawTranscript,
            from_language: "en", from_language_name: "English",
            to_language: targetLang, to_language_name: lang.name,
            context: "Video transcript — preserve natural speech patterns",
            tone: "Conversational", user_id: userId,
          },
        });
        setTranslated(tData?.translated_text || "");
      } else if (!rawTranscript.includes("failed") && !rawTranscript.includes("error")) {
        setTranslated(rawTranscript);
      }
    } catch {
      toast.error("Transcription failed — try again");
    } finally {
      setTranscribing(false);
    }
  };

  const copy = async (text: string, which: "t" | "tr") => {
    await navigator.clipboard.writeText(text);
    if (which === "t") { setCopiedT(true); setTimeout(() => setCopiedT(false), 2000); }
    else { setCopiedTr(true); setTimeout(() => setCopiedTr(false), 2000); }
    toast.success("Copied!");
  };

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className="relative rounded-3xl border-2 border-dashed cursor-pointer transition-all"
        style={{
          borderColor: drag ? "#a78bfa" : file ? "#34d399" : "rgba(255,255,255,0.1)",
          background: drag ? "rgba(167,139,250,0.06)" : file ? "rgba(52,211,153,0.04)" : "rgba(255,255,255,0.02)",
          minHeight: file ? 72 : 180,
        }}>
        <input ref={fileRef} type="file" accept="video/*,audio/*" className="hidden"
          onChange={e => e.target.files?.[0] && acceptFile(e.target.files[0])} />
        {file ? (
          <div className="flex items-center gap-4 p-5">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: file.size > MAX_FILE_SIZE ? "rgba(251,191,36,0.15)" : "rgba(52,211,153,0.15)" }}>
              <Video className="h-6 w-6" style={{ color: file.size > MAX_FILE_SIZE ? "#fbbf24" : "#34d399" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{file.name}</p>
              <p className="text-xs mt-0.5" style={{ color: file.size > MAX_FILE_SIZE ? "#fbbf24" : "rgba(255,255,255,0.4)" }}>
                {(file.size / 1024 / 1024).toFixed(1)} MB
                {file.size > MAX_FILE_SIZE
                  ? " · ⚡ Audio will be extracted automatically (max 25MB)"
                  : " · Click to replace"}
              </p>
            </div>
            <button onClick={e => { e.stopPropagation(); setFile(null); setTranscript(""); setTranslated(""); }}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="h-16 w-16 rounded-2xl mb-4 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.15), rgba(244,114,182,0.1))", border: "1px solid rgba(167,139,250,0.2)" }}>
              <Upload className="h-8 w-8" style={{ color: "#a78bfa" }} />
            </div>
            <p className="text-white font-bold text-base mb-1" style={syne}>Drop your video here</p>
            <p className="text-white/40 text-sm">or click to browse · MP4, MOV, AVI, MP3, WAV</p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              {["🎬 TikTok", "📱 Reels", "▶️ YouTube", "📣 Voiceover"].map(t => (
                <span key={t} className="text-xs text-white/20 px-2 py-1 rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Language + Run button */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div>
          <p className="text-xs text-white/30 mb-2" style={mono}>TRANSLATE OUTPUT TO</p>
          <LangPill value={targetLang} onChange={setTargetLang} />
        </div>
        <button onClick={handleRun} disabled={!file || transcribing}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-7 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ ...syne, background: "linear-gradient(135deg, #a78bfa, #f472b6)", color: "#000" }}>
          {transcribing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : <><Wand2 className="h-4 w-4" /> Transcribe &amp; Translate</>}
        </button>
      </div>

      {/* Dual output */}
      {(transcript || transcribing) && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "#0c0c0c" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4" style={{ color: "#a78bfa" }} />
                <span className="text-sm font-bold text-white" style={syne}>Original Transcript</span>
              </div>
              {transcript && (
                <button onClick={() => copy(transcript, "t")}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                  style={{ background: "rgba(255,255,255,0.05)", color: copiedT ? "#34d399" : "rgba(255,255,255,0.4)" }}>
                  {copiedT ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                </button>
              )}
            </div>
            <div className="p-4 min-h-[140px]">
              {transcribing && !transcript
                ? <div className="flex items-center gap-2 text-white/30 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Transcribing...</div>
                : <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>}
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(52,211,153,0.2)", background: "#0c0c0c" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(52,211,153,0.08)" }}>
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4" style={{ color: "#34d399" }} />
                <span className="text-sm font-bold text-white" style={syne}>
                  {LANGUAGES.find(l => l.code === targetLang)?.flag} {LANGUAGES.find(l => l.code === targetLang)?.name}
                </span>
              </div>
              {translated && (
                <button onClick={() => copy(translated, "tr")}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                  style={{ background: "rgba(52,211,153,0.08)", color: copiedTr ? "#34d399" : "rgba(52,211,153,0.6)" }}>
                  {copiedTr ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                </button>
              )}
            </div>
            <div className="p-4 min-h-[140px]">
              {transcribing && !translated
                ? <div className="flex items-center gap-2 text-white/30 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Translating...</div>
                : translated
                  ? <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{translated}</p>
                  : <p className="text-white/20 text-sm italic">Translation appears here</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Mode B: Script Adapt ─────────────────────────────────────────────────────
const AdaptMode = ({ userId }: { userId: string }) => {
  const [input, setInput] = useState("");
  const [sourceLang, setSourceLang] = useState("pt");
  const [targetLangs, setTargetLangs] = useState<string[]>(["en", "es"]);
  const [tone, setTone] = useState("Aggressive / Urgent");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ lang: string; flag: string; langName: string; market: string; translated_text: string; cultural_adaptation: string; copied: boolean }>>([]);

  const toggleTarget = (code: string) => {
    if (code === sourceLang) return;
    setTargetLangs(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : prev.length < 6 ? [...prev, code] : prev
    );
  };

  const handleAdapt = async () => {
    if (!input.trim()) { toast.error("Paste a script first"); return; }
    if (!targetLangs.length) { toast.error("Select at least one target market"); return; }
    setLoading(true); setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("translate-text", {
        body: {
          source_text: input.trim(),
          from_language: sourceLang,
          from_language_name: LANGUAGES.find(l => l.code === sourceLang)?.name,
          multi_targets: targetLangs,
          tone, context: context.trim() || undefined, user_id: userId,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.mock_mode) toast.info("Add ANTHROPIC_API_KEY in Supabase for real AI translation");
      const rawResults = data?.multi ?? [{ lang: targetLangs[0], translated_text: data?.translated_text, cultural_adaptation: data?.cultural_adaptation }];
      setResults(rawResults.map((r: { lang: string; translated_text: string; cultural_adaptation: string }) => {
        const l = LANGUAGES.find(ll => ll.code === r.lang);
        return { lang: r.lang, flag: l?.flag || "🌍", langName: l?.name || r.lang, market: l?.market || "", translated_text: r.translated_text, cultural_adaptation: r.cultural_adaptation, copied: false };
      }));
    } catch (err: unknown) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setLoading(false); }
  };

  const copyResult = async (idx: number) => {
    await navigator.clipboard.writeText(results[idx].translated_text);
    setResults(p => p.map((r, i) => i === idx ? { ...r, copied: true } : r));
    toast.success("Copied!");
    setTimeout(() => setResults(p => p.map((r, i) => i === idx ? { ...r, copied: false } : r)), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "#0c0c0c" }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-white/30" />
                <span className="text-xs text-white/40" style={mono}>YOUR SCRIPT</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/20" style={mono}>{input.length} chars</span>
                <LangPill value={sourceLang} onChange={setSourceLang} exclude={targetLangs} />
              </div>
            </div>
            <Textarea
              placeholder={"Paste your ad script, VO, caption, or hook here...\n\nInclude hook → body → CTA for best results."}
              value={input} onChange={e => setInput(e.target.value)} rows={10}
              className="bg-transparent border-0 resize-none text-white/80 placeholder:text-white/20 focus-visible:ring-0 px-4 py-3 text-sm leading-relaxed" />
          </div>
          <div>
            <label className="block text-xs text-white/30 mb-2" style={mono}>CONTEXT <span className="text-white/15 normal-case font-sans">(product, platform, audience — optional)</span></label>
            <input value={context} onChange={e => setContext(e.target.value)}
              placeholder='e.g. "iGaming app, TikTok, male 25-35"'
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }} />
          </div>
          <div>
            <label className="block text-xs text-white/30 mb-2.5" style={mono}>TONE</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button key={t.id} onClick={() => setTone(t.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                  style={tone === t.id
                    ? { background: "rgba(167,139,250,0.15)", borderColor: "rgba(167,139,250,0.5)", color: "#a78bfa" }
                    : { background: "transparent", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs text-white/30" style={mono}>TARGET MARKETS</label>
              <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", ...mono }}>{targetLangs.length}/6</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-80 overflow-y-auto">
              {LANGUAGES.filter(l => l.code !== sourceLang).map(l => {
                const active = targetLangs.includes(l.code);
                return (
                  <button key={l.code} onClick={() => toggleTarget(l.code)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left transition-all"
                    style={{
                      background: active ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${active ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.06)"}`,
                      color: active ? "#fff" : "rgba(255,255,255,0.4)",
                    }}>
                    <span className="text-base">{l.flag}</span>
                    <span className="font-medium truncate">{l.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={handleAdapt} disabled={loading || !input.trim() || !targetLangs.length}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ ...syne, background: "linear-gradient(135deg, #a78bfa, #f472b6)", color: "#000" }}>
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Adapting {targetLangs.length} markets...</>
              : <><Sparkles className="h-4 w-4" /> Adapt for {targetLangs.length} market{targetLangs.length !== 1 ? "s" : ""}</>}
          </button>
          <div className="rounded-2xl p-4 text-xs text-white/30 leading-relaxed"
            style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.1)" }}>
            <p className="text-white/50 font-semibold mb-1">Not just translation.</p>
            AI rewrites hooks, adapts slang, urgency phrases, and cultural references — so your ad actually converts in each market.
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white" style={syne}>{results.length} adaptation{results.length > 1 ? "s" : ""} ready</h3>
            {results.length > 1 && (
              <button onClick={async () => {
                const text = results.map(r => `=== ${r.flag} ${r.langName} ===\n${r.translated_text}`).join("\n\n");
                await navigator.clipboard.writeText(text);
                toast.success("All copied!");
              }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Copy className="h-3.5 w-3.5" /> Copy all
              </button>
            )}
          </div>
          <div className={`grid gap-4 ${results.length > 1 ? "md:grid-cols-2" : ""}`}>
            {results.map((r, i) => (
              <div key={r.lang} className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "#0c0c0c" }}>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{r.flag}</span>
                    <div>
                      <p className="text-sm font-bold text-white" style={syne}>{r.langName}</p>
                      <p className="text-[10px] text-white/25">{r.market}</p>
                    </div>
                  </div>
                  <button onClick={() => copyResult(i)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                    style={{ background: "rgba(255,255,255,0.05)", color: r.copied ? "#34d399" : "rgba(255,255,255,0.4)" }}>
                    {r.copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                  </button>
                </div>
                <Textarea value={r.translated_text} readOnly rows={6}
                  className="bg-transparent border-0 resize-none text-white/75 focus-visible:ring-0 px-4 py-3 text-sm" />
                {r.cultural_adaptation && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl p-3" style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.12)" }}>
                      <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "rgba(52,211,153,0.5)", ...mono }}>Cultural notes</p>
                      <p className="text-[11px] text-white/40 leading-relaxed">{r.cultural_adaptation}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const TranslatePage = () => {
  const { user } = useOutletContext<DashboardContext>();
  const [mode, setMode] = useState<"transcribe" | "adapt">("transcribe");

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.2), rgba(52,211,153,0.05))", border: "1px solid rgba(52,211,153,0.2)" }}>
          <Globe className="h-5 w-5" style={{ color: "#34d399" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white" style={syne}>Translate &amp; Transcribe</h1>
          <p className="text-xs text-white/30">Drop a video to extract the script · Adapt any text for any market</p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {([
          { id: "transcribe" as const, icon: <Video className="h-4 w-4" />, label: "Video → Transcript" },
          { id: "adapt" as const, icon: <Languages className="h-4 w-4" />, label: "Script → Markets" },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setMode(tab.id)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
            style={mode === tab.id ? { ...syne, background: "#fff", color: "#000" } : { ...syne, color: "rgba(255,255,255,0.4)" }}>
            {tab.icon} <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Mode description banner */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{
          background: mode === "transcribe" ? "rgba(167,139,250,0.06)" : "rgba(52,211,153,0.06)",
          border: `1px solid ${mode === "transcribe" ? "rgba(167,139,250,0.15)" : "rgba(52,211,153,0.15)"}`,
        }}>
        {mode === "transcribe" ? (
          <>
            <Mic className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#a78bfa" }} />
            <div>
              <p className="text-sm font-bold text-white" style={syne}>Drop any video — get the full script</p>
              <p className="text-xs text-white/40 mt-0.5 leading-relaxed">Upload a competitor ad, your own footage, or a reference clip. AI extracts the transcript in the original language, then translates it to your target language — perfect for briefing editors.</p>
            </div>
          </>
        ) : (
          <>
            <Wand2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#34d399" }} />
            <div>
              <p className="text-sm font-bold text-white" style={syne}>Paste your script — adapt it for any market</p>
              <p className="text-xs text-white/40 mt-0.5 leading-relaxed">AI doesn't just translate — it rewrites hooks, adapts urgency phrases, cultural references, and slang so your script actually converts. Select up to 6 markets at once.</p>
            </div>
          </>
        )}
      </div>

      {mode === "transcribe" ? <TranscribeMode userId={user.id} /> : <AdaptMode userId={user.id} />}
    </div>
  );
};

export default TranslatePage;
