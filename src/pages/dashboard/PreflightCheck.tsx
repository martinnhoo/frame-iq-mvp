import { useState } from "react";
import { Upload, CheckCircle, AlertTriangle, XCircle, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
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
  { value: "FR", label: "🇫🇷 France" },
  { value: "DE", label: "🇩🇪 Germany" },
  { value: "JP", label: "🇯🇵 Japan" },
  { value: "AU", label: "🇦🇺 Australia" },
  { value: "AE", label: "🇦🇪 UAE" },
  { value: "NG", label: "🇳🇬 Nigeria" },
  { value: "ZA", label: "🇿🇦 South Africa" },
  { value: "GLOBAL", label: "🌐 Global" },
];

type StatusType = "STRONG" | "SOLID" | "OPTIMAL" | "CLEAR" | "REVIEW" | "WEAK" | "ERROR" | "CRITICAL";

const StatusBadge = ({ status }: { status: StatusType }) => {
  const config: Record<StatusType, { color: string; icon: React.ReactNode }> = {
    STRONG:   { color: "text-green-400 border-green-400/30 bg-green-400/10", icon: <CheckCircle className="h-3 w-3" /> },
    SOLID:    { color: "text-green-400 border-green-400/30 bg-green-400/10", icon: <CheckCircle className="h-3 w-3" /> },
    OPTIMAL:  { color: "text-green-400 border-green-400/30 bg-green-400/10", icon: <CheckCircle className="h-3 w-3" /> },
    CLEAR:    { color: "text-green-400 border-green-400/30 bg-green-400/10", icon: <CheckCircle className="h-3 w-3" /> },
    REVIEW:   { color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10", icon: <AlertTriangle className="h-3 w-3" /> },
    WEAK:     { color: "text-red-400 border-red-400/30 bg-red-400/10", icon: <XCircle className="h-3 w-3" /> },
    ERROR:    { color: "text-red-400 border-red-400/30 bg-red-400/10", icon: <XCircle className="h-3 w-3" /> },
    CRITICAL: { color: "text-red-400 border-red-400/30 bg-red-400/10 font-bold", icon: <XCircle className="h-3 w-3" /> },
  };
  const { color, icon } = config[status] || config.REVIEW;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono ${color}`}>
      {icon}{status}
    </span>
  );
};

const MOCK_RESULT = {
  overview: [
    { label: "Hook", status: "STRONG" as StatusType, detail: "Product visible in first 2 seconds" },
    { label: "Promo", status: "REVIEW" as StatusType, detail: "Promo code appears too late (after 0:20)" },
    { label: "Narrative", status: "SOLID" as StatusType, detail: "Routine → Product → CTA structure detected" },
    { label: "Platform Fit", status: "OPTIMAL" as StatusType, detail: "Format ideal for selected platform" },
  ],
  safeZone: [
    { platform: "TikTok", status: "REVIEW" as StatusType, detail: "Text at 0:08 may be clipped on left margin" },
    { platform: "Reels", status: "CLEAR" as StatusType, detail: "Within safe zone" },
    { platform: "Facebook", status: "REVIEW" as StatusType, detail: "Face cropped in 1:1 feed at 0:03" },
  ],
  onscreen: [
    { timestamp: "0:03", text: "Use code SAVE10", status: "CLEAR" as StatusType, detail: "Spelling correct" },
    { timestamp: "0:08", text: "10% de descnto", status: "ERROR" as StatusType, detail: "Typo — should be 'desconto'" },
    { timestamp: "0:18", text: "Só essa seman!", status: "ERROR" as StatusType, detail: "Incomplete word — should be 'semana'" },
    { timestamp: "0:24", text: "Brand Name", status: "CLEAR" as StatusType, detail: "Correct" },
  ],
  topFixes: [
    "Fix typo 'descnto' → 'desconto' at 0:08",
    "Fix incomplete word 'seman' → 'semana' at 0:18",
    "Move promo code to before 0:15 for higher conversion",
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
    const valid = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm"];
    if (!valid.includes(f.type)) { toast.error("Unsupported format. Use MP4, MOV, AVI, MKV or WebM."); return; }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const runCheck = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Please sign in."); return; }
      // Edge function call ready — uncomment when API keys are added
      // const { data, error } = await supabase.functions.invoke('run-preflight', {
      //   body: { video_name: file.name, platform, market, user_id: user.id }
      // });
      await new Promise(r => setTimeout(r, 2500));
      setResult(MOCK_RESULT);
      toast.success("Pre-flight check complete.");
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Plane className="h-6 w-6" /> Pre-flight Check
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Review your video before posting — catch errors before they cost you.</p>
      </div>

      {/* Upload */}
      <Card className="bg-[#0a0a0a] border-[#222]">
        <CardContent className="p-6 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("pf-input")?.click()}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all
              ${dragOver ? "border-white bg-white/5" : "border-[#333] hover:border-[#555]"}`}
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-3" />
            {file ? (
              <p className="text-white font-medium text-sm">{file.name}</p>
            ) : (
              <>
                <p className="text-white text-sm font-medium">Drop your video here</p>
                <p className="text-muted-foreground text-xs mt-1">MP4, MOV, AVI, MKV, WebM</p>
              </>
            )}
            <input id="pf-input" type="file" accept="video/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">PLATFORM</label>
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
              <label className="text-xs text-muted-foreground mb-1 block">MARKET</label>
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

          <Button onClick={runCheck} disabled={!file || loading} className="w-full bg-white text-black hover:bg-white/90 font-semibold">
            {loading ? "Analyzing..." : "Run Pre-flight Check"}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Overview */}
          <Card className="bg-[#0a0a0a] border-[#222]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-widest">Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {result.overview.map((row, i) => (
                    <tr key={i} className="border-t border-[#1a1a1a]">
                      <td className="px-4 py-3 text-muted-foreground w-32 font-mono text-xs">{row.label}</td>
                      <td className="px-4 py-3 w-32"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 text-white/70 text-xs">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Safe Zone */}
          <Card className="bg-[#0a0a0a] border-[#222]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-widest">Safe Zone Check</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {result.safeZone.map((row, i) => (
                    <tr key={i} className="border-t border-[#1a1a1a]">
                      <td className="px-4 py-3 text-muted-foreground w-32 font-mono text-xs">{row.platform}</td>
                      <td className="px-4 py-3 w-32"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 text-white/70 text-xs">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Onscreen Text */}
          <Card className="bg-[#0a0a0a] border-[#222]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-widest">Onscreen Text Review</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a1a]">
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground font-normal">Time</th>
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground font-normal">Text detected</th>
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground font-normal">Status</th>
                    <th className="px-4 py-2 text-left text-xs text-muted-foreground font-normal">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {result.onscreen.map((row, i) => (
                    <tr key={i} className="border-t border-[#1a1a1a]">
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{row.timestamp}</td>
                      <td className="px-4 py-3 text-white text-xs font-mono">"{row.text}"</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 text-white/70 text-xs">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Top Fixes */}
          <Card className="bg-[#0a0a0a] border-[#222]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-widest">Top Fixes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {result.topFixes.map((fix, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-white/30 font-mono text-xs mt-0.5">{i + 1}.</span>
                  <span className="text-white/80">{fix}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
