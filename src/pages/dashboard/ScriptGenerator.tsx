import { useState } from "react";
import { FileText, Sparkles, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const mono = { fontFamily: "'DM Mono', monospace" } as const;

export default function ScriptGenerator() {
  const [product, setProduct] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [market, setMarket] = useState("global");
  const [duration, setDuration] = useState("30");
  const [angle, setAngle] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const generate = async () => {
    if (!product.trim()) { toast.error("Enter a product/service description"); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-script", {
        body: { product, platform, market, duration: Number(duration), angle },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate script");
    } finally {
      setLoading(false);
    }
  };

  const copyScript = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(167,139,250,0.15)" }}>
          <FileText className="h-5 w-5" style={{ color: "#a78bfa" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground" style={syne}>Script Generator</h1>
          <p className="text-sm text-muted-foreground" style={mono}>AI-powered ad scripts for any platform</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 p-6 space-y-4" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Product / Service</label>
          <Textarea placeholder="Describe your product, service, or offer..." value={product} onChange={e => setProduct(e.target.value)} className="min-h-[80px]" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Platform</label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="reels">Reels</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Market</label>
            <Input value={market} onChange={e => setMarket(e.target.value)} placeholder="e.g. US, BR, global" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Duration (s)</label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15s</SelectItem>
                <SelectItem value="30">30s</SelectItem>
                <SelectItem value="60">60s</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Angle (optional)</label>
            <Input value={angle} onChange={e => setAngle(e.target.value)} placeholder="e.g. FOMO, curiosity" />
          </div>
        </div>

        <Button onClick={generate} disabled={loading} className="w-full gap-2" style={{ background: "linear-gradient(135deg, #a78bfa, #f472b6)" }}>
          <Sparkles className="h-4 w-4" />
          {loading ? "Generating..." : "Generate Script"}
        </Button>
      </div>

      {result?.scripts && (
        <div className="space-y-4">
          {result.scripts.map((s: any, i: number) => (
            <div key={i} className="rounded-2xl border border-border/50 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground" style={syne}>Variant {i + 1}: {s.angle || ""}</span>
                <Button size="sm" variant="ghost" onClick={() => copyScript(s.script, i)} className="gap-1.5">
                  {copied === i ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === i ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed" style={mono}>{s.script}</pre>
              {s.hook_type && (
                <span className="inline-block text-[10px] font-bold px-2 py-1 rounded-full" style={{ ...mono, color: "#a78bfa", background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.2)" }}>
                  {s.hook_type}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
