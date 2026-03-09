import { useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Globe, ArrowRight, Copy, Check, Upload, Video, X, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const LANGUAGES = [
  { code: "en", flag: "🇺🇸", name: "English", short: "EN" },
  { code: "pt", flag: "🇧🇷", name: "Português", short: "PT" },
  { code: "es", flag: "🇪🇸", name: "Español", short: "ES" },
  { code: "fr", flag: "🇫🇷", name: "Français", short: "FR" },
  { code: "de", flag: "🇩🇪", name: "Deutsch", short: "DE" },
  { code: "it", flag: "🇮🇹", name: "Italiano", short: "IT" },
  { code: "ar", flag: "🇸🇦", name: "عربي", short: "AR" },
  { code: "zh", flag: "🇨🇳", name: "中文", short: "ZH" },
  { code: "ja", flag: "🇯🇵", name: "日本語", short: "JA" },
  { code: "ko", flag: "🇰🇷", name: "한국어", short: "KO" },
  { code: "hi", flag: "🇮🇳", name: "हिन्दी", short: "HI" },
  { code: "tr", flag: "🇹🇷", name: "Türkçe", short: "TR" },
];

type Mode = "script" | "video";

const TranslatePage = () => {
  const [mode, setMode] = useState<Mode>("script");
  const [sourceLang, setSourceLang] = useState("pt");
  const [targetLang, setTargetLang] = useState("en");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<{ transcript?: string; translated?: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const sourceLangData = LANGUAGES.find(l => l.code === sourceLang)!;
  const targetLangData = LANGUAGES.find(l => l.code === targetLang)!;

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => /\.(mp4|mov|avi|mkv|webm)$/i.test(f.name));
    if (!dropped.length) { toast.error("Video files only (MP4, MOV, AVI, MKV, WebM)"); return; }
    setFiles(p => [...p, ...dropped]);
  }, []);

  const addFiles = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.multiple = true; inp.accept = "video/*";
    inp.onchange = e => setFiles(p => [...p, ...Array.from((e.target as HTMLInputElement).files || [])]);
    inp.click();
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key); toast.success("Copied");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRun = async () => {
    if (mode === "script" && !input.trim()) return;
    if (mode === "video" && !files.length) return;
    setLoading(true); setOutput(null);
    try {
      const { data, error } = await supabase.functions.invoke("translate-text", {
        body: {
          text: input,
          source_language: sourceLang,
          source_language_name: sourceLangData.name,
          target_language: targetLang,
          target_language_name: targetLangData.name,
          include_transcript: true,
          mode,
        },
      });
      if (error) throw error;
      if (data?.mock_mode) {
        toast.error("Add ANTHROPIC_API_KEY to Supabase Secrets to enable translation");
        return;
      }
      setOutput({ transcript: data?.transcript, translated: data?.translated_text });
    } catch {
      toast.error("Translation failed");
    } finally {
      setLoading(false);
    }
  };

  const LangChip = ({ code, selected, onChange }: { code: string; selected: string; onChange: (c: string) => void }) => {
    const lang = LANGUAGES.find(l => l.code === code)!;
    const [open, setOpen] = useState(false);
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-white text-sm transition-all"
        >
          <span>{lang.flag}</span>
          <span className="font-medium">{lang.name}</span>
          <ChevronDown className="h-3 w-3 text-white/30" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute top-full mt-1 left-0 z-20 bg-[#0d0d0d] border border-white/10 rounded-xl shadow-xl p-2 min-w-[160px]">
              {LANGUAGES.filter(l => l.code !== (code === selected ? targetLang : sourceLang)).map(l => (
                <button
                  key={l.code}
                  onClick={() => { onChange(l.code); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    l.code === selected ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  <span>{l.flag}</span> <span>{l.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Transcript & Translate</h1>
        <p className="text-white/30 text-sm mt-0.5">
          Transcribe video audio and translate ad scripts with cultural context preserved.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-fit">
        {(["script", "video"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all ${
              mode === m ? "bg-white text-black font-semibold" : "text-white/40 hover:text-white"
            }`}
          >
            {m === "script" ? <Globe className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
            {m === "script" ? "Script / Text" : "Video Upload"}
          </button>
        ))}
      </div>

      {/* Language row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/25 uppercase tracking-widest">From</span>
          <LangChip code={sourceLang} selected={sourceLang} onChange={setSourceLang} />
        </div>
        <ArrowRight className="h-4 w-4 text-white/20 mt-4" />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/25 uppercase tracking-widest">To</span>
          <LangChip code={targetLang} selected={targetLang} onChange={setTargetLang} />
        </div>
      </div>

      {/* Input area */}
      {mode === "script" ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-xs text-white/30">Source — {sourceLangData.flag} {sourceLangData.name}</span>
            <span className="text-xs text-white/20 font-mono">{input.length} chars</span>
          </div>
          <Textarea
            placeholder="Paste your ad script, VO, or caption here..."
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={7}
            className="bg-transparent border-0 resize-none text-white/80 placeholder:text-white/20 focus-visible:ring-0 px-4 py-3"
          />
        </div>
      ) : (
        <div
          className={`rounded-2xl border-2 border-dashed transition-all ${isDragging ? "border-white/30 bg-white/[0.05]" : "border-white/[0.08] bg-white/[0.02]"}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          {files.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/[0.06] flex items-center justify-center">
                <Upload className="h-5 w-5 text-white/30" />
              </div>
              <p className="text-sm text-white/40">Drop video here</p>
              <p className="text-xs text-white/20">MP4, MOV, AVI, MKV, WebM</p>
              <button onClick={addFiles} className="px-4 py-2 rounded-xl bg-white/[0.08] text-white/60 hover:text-white text-sm transition-colors mt-1">
                Browse files
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.05]">
                  <Video className="h-4 w-4 text-white/30 shrink-0" />
                  <span className="flex-1 text-sm text-white/70 truncate">{f.name}</span>
                  <span className="text-xs text-white/20 font-mono">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                  <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} className="text-white/20 hover:text-red-400 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={addFiles} className="text-xs text-white/25 hover:text-white/50 transition-colors px-3 pt-1">
                + Add more
              </button>
            </div>
          )}
        </div>
      )}

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={loading || (mode === "script" ? !input.trim() : !files.length)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
        ) : (
          <>
            <span>{targetLangData.flag}</span>
            Translate to {targetLangData.name}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Output */}
      {output && (
        <div className="space-y-3">
          {output.transcript && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <span className="text-xs text-white/30">Transcript — {sourceLangData.flag} {sourceLangData.name}</span>
                <button onClick={() => copyText(output.transcript!, "transcript")} className="flex items-center gap-1 text-xs text-white/30 hover:text-white transition-colors">
                  {copied === "transcript" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  Copy
                </button>
              </div>
              <Textarea value={output.transcript} readOnly rows={4} className="bg-transparent border-0 resize-none text-white/60 focus-visible:ring-0 px-4 py-3" />
            </div>
          )}
          {output.translated && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <span className="text-xs text-white/30">Translation — {targetLangData.flag} {targetLangData.name}</span>
                <button onClick={() => copyText(output.translated!, "translated")} className="flex items-center gap-1 text-xs text-white/30 hover:text-white transition-colors">
                  {copied === "translated" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  Copy
                </button>
              </div>
              <Textarea value={output.translated} readOnly rows={5} className="bg-transparent border-0 resize-none text-white/80 focus-visible:ring-0 px-4 py-3" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranslatePage;
