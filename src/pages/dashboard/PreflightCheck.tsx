import { useState } from "react";
import { Upload, CheckCircle, AlertTriangle, XCircle, Plane, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "reels", label: "Instagram Reels" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube Shorts" },
];

const MARKETS = [
  { value: "BR", label: "🇧🇷 Brazil" },
  { value: "MX", label: "🇲🇽 Mexico" },
  { value: "IN", label: "🇮🇳 India" },
  { value: "US", label: "🇺🇸 United States" },
  { value: "GB", label: "🇬🇧 United Kingdom" },
  { value: "AR", label: "🇦🇷 Argentina" },
  { value: "CO", label: "🇨🇴 Colombia" },
  { value: "ES", label: "🇪🇸 Spain" },
  { value: "GLOBAL", label: "🌐 Global" },
];

type StatusType = "STRONG" | "SOLID" | "OPTIMAL" | "CLEAR" | "REVIEW" | "WEAK" | "ERROR" | "CRITICAL";

const STATUS_CONFIG: Record<StatusType, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  STRONG:   { color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/30",  icon: <CheckCircle className="h-3 w-3" /> },
  SOLID:    { color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/30",  icon: <CheckCircle className="h-3 w-3" /> },
  OPTIMAL:  { color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/30",  icon: <CheckCircle className="h-3 w-3" /> },
  CLEAR:    { color: "text-green-400",  bg: "bg-green-400/10",  border: "border-green-400/30",  icon: <CheckCircle className="h-3 w-3" /> },
  REVIEW:   { color: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/30",  icon: <AlertTriangle className="h-3 w-3" /> },
  WEAK:     { color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/30",    icon: <XCircle className="h-3 w-3" /> },
  ERROR:    { color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/30",    icon: <XCircle className="h-3 w-3" /> },
  CRITICAL: { color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/30",    icon: <XCircle className="h-3 w-3" /> },
};

const StatusBadge = ({ status }: { status: StatusType }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.REVIEW;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono font-semibold ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {cfg.icon}{status}
    </span>
  );
};

const MOCK_RESULT = {
  overview: [
    { label: "Hook",         status: "STRONG"  as StatusType, detail: "Product visible in first 2s, direct eye contact" },
    { label: "Promo",        status: "REVIEW"  as StatusType, detail: "Promo code appears at 0:24 — move before 0:15" },
    { label: "Narrative",    status: "SOLID"   as StatusType, detail: "Routine → Product → CTA structure detected" },
    { label: "Platform Fit", status: "OPTIMAL" as StatusType, detail: "Format and pacing ideal for selected platform" },
  ],
  safeZone: [
    { platform: "TikTok",       status: "REVIEW" as StatusType, detail: "Text at 0:08 clipped on left margin" },
    { platform: "Reels",        status: "CLEAR"  as StatusType, detail: "All elements within safe zone" },
    { platform: "Facebook Feed",status: "REVIEW" as StatusType, detail: "Face cropped in 1:1 crop at 0:03" },
  ],
  onscreen: [
    { timestamp: "0:03", text: "Use code SAVE10",   status: "CLEAR" as StatusType, detail: "Spelling correct" },
    { timestamp: "0:08", text: "10% de descnto",    status: "ERROR" as StatusType, detail: "Typo — 'descnto' → 'desconto'" },
    { timestamp: "0:18", text: "Só essa seman!",    status: "ERROR" as StatusType, detail: "Incomplete word — 'seman' → 'semana'" },
    { timestamp: "0:24", text: "Brand Name",         status: "CLEAR" as StatusType, detail: "Correct" },
  ],
  topFixes: [
    "Fix typo 'descnto' → 'desconto' at 0:08",
    "Move promo code to before 0:15 to maximize conversions",
    "Reframe shot at 0:03 — face is cropped in Facebook 1:1 format",
  ],
};

export default function PreflightCheck() {
  const [file, setFile] = useState<File | null>(null);
  const [platform, setPlatform] = useState("reels");
  const [market, setMarket] = useState("BR");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<typeof MOCK_RESULT | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const runCheck = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-preflight", {
        body: { video_name: file.name, platform, market },
      });

      if (error) throw error;

      if (data?.mock_mode) {
        toast.error("API keys not configured yet. Add ANTHROPIC_API_KEY to Supabase secrets to enable Pre-flight Check.");
        setLoading(false);
        return;
      }

      setResult(data);
      toast.success("Pre-flight check complete.");
    } catch {
      toast.error("Pre-flight check unavailable. Add ANTHROPIC_API_KEY to Supabase secrets.");
    } finally {
      setLoading(false);
    }
  };

  const errCount = result ? [
    ...result.safeZone.filter(r => r.status === "REVIEW"),
    ...result.onscreen.filter(r => r.status === "ERROR"),
  ].length : 0;

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Plane className="h-5 w-5 text-white/60" /> Pre-flight Check
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review your video before posting — catch errors before they cost you.
          </p>
        </div>
        {result && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-mono ${
            errCount === 0
              ? "border-green-400/30 bg-green-400/10 text-green-400"
              : "border-amber-400/30 bg-amber-400/10 text-amber-400"
          }`}>
            {errCount === 0 ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {errCount === 0 ? "READY TO POST" : `${errCount} ISSUES FOUND`}
          </div>
        )}
      </div>

      {/* Upload card */}
      <Card className="bg-[#0a0a0a] border-[#222]">
        <CardContent className="page-enter p-6 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("pf-input")?.click()}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? "border-white/40 bg-white/5"
                : file
                ? "border-green-400/40 bg-green-400/5"
                : "border-[#333] hover:border-[#555] hover:bg-white/[0.02]"
            }`}
          >
            <input id="pf-input" type="file" accept="video/*" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            {file ? (
              <>
                <CheckCircle className="h-8 w-8 text-green-400 mb-3" />
                <p className="text-white font-mono text-sm">{file.name}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · Click to change
                </p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-white text-sm font-medium">Drop your video here</p>
                <p className="text-muted-foreground text-xs mt-1">MP4, MOV, AVI, MKV, WebM</p>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1.5 block tracking-wider">PLATFORM</label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="bg-[#111] border-[#333] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1.5 block tracking-wider">MARKET</label>
              <Select value={market} onValueChange={setMarket}>
                <SelectTrigger className="bg-[#111] border-[#333] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#333]">
                  {MARKETS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={runCheck}
            disabled={!file || loading}
            className="w-full bg-white text-black hover:bg-white/90 font-semibold h-11"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
            ) : "Run Pre-flight Check"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-3">

          {/* Overview */}
          <Card className="bg-[#0a0a0a] border-[#222] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a1a1a]">
              <span className="text-xs font-mono text-muted-foreground tracking-widest">OVERVIEW</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {result.overview.map((row, i) => (
                  <tr key={i} className={i > 0 ? "border-t border-[#1a1a1a]" : ""}>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs w-32">{row.label}</td>
                    <td className="px-4 py-3 w-36"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-white/60 text-xs">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Safe Zone */}
          <Card className="bg-[#0a0a0a] border-[#222] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a1a1a]">
              <span className="text-xs font-mono text-muted-foreground tracking-widest">SAFE ZONE CHECK</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {result.safeZone.map((row, i) => (
                  <tr key={i} className={i > 0 ? "border-t border-[#1a1a1a]" : ""}>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs w-32">{row.platform}</td>
                    <td className="px-4 py-3 w-36"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-white/60 text-xs">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Onscreen Text */}
          <Card className="bg-[#0a0a0a] border-[#222] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a1a1a]">
              <span className="text-xs font-mono text-muted-foreground tracking-widest">ONSCREEN TEXT REVIEW</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  <th className="px-4 py-2 text-left text-xs text-muted-foreground/50 font-normal">Time</th>
                  <th className="px-4 py-2 text-left text-xs text-muted-foreground/50 font-normal">Text detected</th>
                  <th className="px-4 py-2 text-left text-xs text-muted-foreground/50 font-normal">Status</th>
                  <th className="px-4 py-2 text-left text-xs text-muted-foreground/50 font-normal">Detail</th>
                </tr>
              </thead>
              <tbody>
                {result.onscreen.map((row, i) => (
                  <tr key={i} className="border-t border-[#1a1a1a]">
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{row.timestamp}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/80">"{row.text}"</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-white/60 text-xs">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Top Fixes */}
          <Card className="bg-[#0a0a0a] border-amber-400/20 overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-400/10 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-mono text-amber-400 tracking-widest">TOP FIXES</span>
            </div>
            <div className="p-4 space-y-3">
              {result.topFixes.map((fix, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-amber-400/60 font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                  <span className="text-white/80 text-sm">{fix}</span>
                </div>
              ))}
            </div>
          </Card>

        </div>
      )}
    </div>
  );
}
