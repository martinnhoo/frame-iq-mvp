import { useState } from "react";
import { ClipboardList, Sparkles, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const mono = { fontFamily: "'DM Mono', monospace" } as const;

export default function BriefGenerator() {
  const [product, setProduct] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [market, setMarket] = useState("global");
  const [objective, setObjective] = useState("awareness");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!product.trim()) { toast.error("Enter a product/service description"); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-brief", {
        body: { product, platform, market, objective, notes },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate brief");
    } finally {
      setLoading(false);
    }
  };

  const copyBrief = () => {
    if (!result?.brief) return;
    navigator.clipboard.writeText(result.brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(96,165,250,0.15)" }}>
          <ClipboardList className="h-5 w-5" style={{ color: "#60a5fa" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground" style={syne}>Brief Generator</h1>
          <p className="text-sm text-muted-foreground" style={mono}>Generate creative briefs for your team</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 p-6 space-y-4" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Product / Service</label>
          <Textarea placeholder="Describe your product, service, or campaign..." value={product} onChange={e => setProduct(e.target.value)} className="min-h-[80px]" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Platform</label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="reels">Instagram Reels</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="multi">Multi-platform</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Market</label>
            <Input value={market} onChange={e => setMarket(e.target.value)} placeholder="e.g. US, BR, global" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Objective</label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="awareness">Awareness</SelectItem>
                <SelectItem value="consideration">Consideration</SelectItem>
                <SelectItem value="conversion">Conversion</SelectItem>
                <SelectItem value="retention">Retention</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Additional Notes (optional)</label>
          <Textarea placeholder="Any specific requirements, tone, audience details..." value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[60px]" />
        </div>

        <Button onClick={generate} disabled={loading} className="w-full gap-2" style={{ background: "linear-gradient(135deg, #60a5fa, #a78bfa)" }}>
          <Sparkles className="h-4 w-4" />
          {loading ? "Generating..." : "Generate Brief"}
        </Button>
      </div>

      {result?.brief && (
        <div className="rounded-2xl border border-border/50 p-6 space-y-4" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground" style={syne}>Creative Brief</span>
            <Button size="sm" variant="ghost" onClick={copyBrief} className="gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed" style={mono}>{result.brief}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
