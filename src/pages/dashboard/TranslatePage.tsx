import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Globe, ArrowRight, Copy, Check, Upload, Video, FolderOpen, X } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const targetLanguages = [
  { code: "en", flag: "🇺🇸", name: "English" },
  { code: "es", flag: "🇪🇸", name: "Español" },
  { code: "fr", flag: "🇫🇷", name: "Français" },
  { code: "de", flag: "🇩🇪", name: "Deutsch" },
  { code: "pt", flag: "🇧🇷", name: "Português" },
  { code: "ar", flag: "🇸🇦", name: "العربية" },
  { code: "zh", flag: "🇨🇳", name: "中文" },
  { code: "ja", flag: "🇯🇵", name: "日本語" },
  { code: "ko", flag: "🇰🇷", name: "한국어" },
  { code: "it", flag: "🇮🇹", name: "Italiano" },
  { code: "hi", flag: "🇮🇳", name: "हिन्दी" },
  { code: "tr", flag: "🇹🇷", name: "Türkçe" },
];

const TranslatePage = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [translating, setTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedLang, setSelectedLang] = useState("en");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<"script" | "video">("video");

  const selectedLangData = targetLanguages.find((l) => l.code === selectedLang)!;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(mp4|mov|avi|mkv|webm)$/i.test(f.name)
    );
    if (droppedFiles.length === 0) {
      toast.error("Please drop video files (MP4, MOV, AVI, MKV, WebM)");
      return;
    }
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "video/*";
    input.onchange = (e) => {
      const selected = Array.from((e.target as HTMLInputElement).files || []);
      setFiles((prev) => [...prev, ...selected]);
    };
    input.click();
  };

  const handleFolderSelect = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.onchange = (e) => {
      const selected = Array.from((e.target as HTMLInputElement).files || []).filter((f) =>
        /\.(mp4|mov|avi|mkv|webm)$/i.test(f.name)
      );
      if (selected.length === 0) {
        toast.error("No video files found in this folder");
        return;
      }
      setFiles((prev) => [...prev, ...selected]);
    };
    input.click();
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTranslate = () => {
    if (mode === "script" && !input.trim()) return;
    if (mode === "video" && files.length === 0) return;

    setTranslating(true);
    setTimeout(() => {
      setOutput(
        `This is a simulated translation to ${selectedLangData.name}. In production, FrameIQ's AI engine translates your ad scripts while preserving cultural nuance, slang adaptation, and emotional tone for each target market.`
      );
      setTranslating(false);
    }, 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const canTranslate =
    (mode === "script" && input.trim()) || (mode === "video" && files.length > 0);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Auto Translation</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Translate ad scripts or video audio across languages with cultural context preserved.
        </p>
      </div>

      {/* Target language selection */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Target Language</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {targetLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setSelectedLang(lang.code)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all border ${
                  selectedLang === lang.code
                    ? "bg-accent border-primary text-accent-foreground font-medium"
                    : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Input mode tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as "script" | "video")}>
        <TabsList className="bg-muted">
          <TabsTrigger value="video" className="gap-1.5">
            <Video className="h-3.5 w-3.5" />
            Video Upload
          </TabsTrigger>
          <TabsTrigger value="script" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Script / Text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="video" className="mt-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              {/* Drop zone */}
              <div
                className={`relative rounded-xl transition-all duration-200 flex flex-col items-center justify-center text-center p-10 border-2 border-dashed ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-foreground font-medium">
                  Drag & drop video files here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  MP4, MOV, AVI, MKV, WebM
                </p>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFileSelect}
                    className="gap-1.5 border-border"
                  >
                    <Video className="h-3.5 w-3.5" />
                    Browse Files
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFolderSelect}
                    className="gap-1.5 border-border"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Select Folder
                  </Button>
                </div>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">
                    {files.length} video{files.length !== 1 ? "s" : ""} selected
                  </p>
                  {files.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-muted border border-border"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Video className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground truncate">
                          {file.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0 border-border text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </Badge>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="script" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Source Text</span>
                <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                  Auto-detect
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Paste your ad script or transcript here..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={8}
                className="bg-muted border-border resize-none"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Output */}
      {output && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="text-base">{selectedLangData.flag}</span>
                {selectedLangData.name}
              </span>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs text-muted-foreground">
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={output}
              readOnly
              rows={6}
              className="bg-muted border-border resize-none"
            />
          </CardContent>
        </Card>
      )}

      {/* Translate button */}
      <Button
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 h-12"
        onClick={handleTranslate}
        disabled={!canTranslate || translating}
      >
        {translating ? (
          <>
            <Globe className="h-4 w-4 mr-2 animate-spin" />
            Translating...
          </>
        ) : (
          <>
            Translate to {selectedLangData.flag} {selectedLangData.name}
            <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
};

export default TranslatePage;
