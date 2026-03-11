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
  const [offer, setOffer] = useState("");
  const [audience, setAudience] = useState("");
  const [format, setFormat] = useState("ugc");
  const [platform, setPlatform] = useState("tiktok");
  const [market, setMarket] = useState("US");
  const [duration, setDuration] = useState("30s");
  const [angle, setAngle] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const generate = async () => {
    if (!product.trim()) { toast.error("Enter a product/service description"); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-script", {
        body: { product, offer, audience, format, platform, market, duration, angle, extra_context: extraContext },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate script");
    } finally {
      setLoading(false);
    }
  };

  const copyScript = (script: any, idx: number) => {
    const text = script.lines?.map((l: any) => `[${l.type.toUpperCase()}] ${l.text}`).join("\n") || JSON.stringify(script, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const lineColors: Record<string, { bg: string; color: string; label: string }> = {
    vo:       { bg: "rgba(167,139,250,0.12)", color: "#a78bfa", label: "VO" },
    onscreen: { bg: "rgba(96,165,250,0.12)",  color: "#60a5fa", label: "ON-SCREEN" },
    visual:   { bg: "rgba(52,211,153,0.12)",  color: "#34d399", label: "VISUAL" },
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
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Product / Service *</label>
          <Textarea placeholder="Describe your product, service, or brand..." value={product} onChange={e => setProduct(e.target.value)} className="min-h-[80px]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Offer / CTA (optional)</label>
            <Input value={offer} onChange={e => setOffer(e.target.value)} placeholder="e.g. 50% off first month, Free trial" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Target Audience (optional)</label>
            <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g. Men 25-35, gamers, fitness enthusiasts" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Format</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ugc">UGC</SelectItem>
                <SelectItem value="vsl">VSL</SelectItem>
                <SelectItem value="talking_head">Talking Head</SelectItem>
                <SelectItem value="hook_only">Hook Only</SelectItem>
                <SelectItem value="product_demo">Product Demo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Market</label>
            <Select value={market} onValueChange={setMarket}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="US">🇺🇸 US</SelectItem>
                <SelectItem value="BR">🇧🇷 Brazil</SelectItem>
                <SelectItem value="MX">🇲🇽 Mexico</SelectItem>
                <SelectItem value="IN">🇮🇳 India</SelectItem>
                <SelectItem value="GLOBAL">🌍 Global</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Duration</label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15s">15s</SelectItem>
                <SelectItem value="30s">30s</SelectItem>
                <SelectItem value="60s">60s</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Angle</label>
            <Input value={angle} onChange={e => setAngle(e.target.value)} placeholder="e.g. FOMO, curiosity, social proof" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Extra Context (optional)</label>
          <Textarea placeholder="Compliance rules, brand guidelines, specific messaging..." value={extraContext} onChange={e => setExtraContext(e.target.value)} className="min-h-[60px]" />
        </div>

        <Button onClick={generate} disabled={loading} className="w-full gap-2" style={{ background: "linear-gradient(135deg, #a78bfa, #f472b6)" }}>
          <Sparkles className="h-4 w-4" />
          {loading ? "Generating 3 scripts..." : "Generate Scripts"}
        </Button>
      </div>

      {result?.scripts && (
        <div className="space-y-4">
          {result.scripts.map((s: any, i: number) => (
            <div key={i} className="rounded-2xl border border-border/50 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground" style={syne}>{s.title || `Variant ${i + 1}`}</span>
                  {s.hook_score != null && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ ...mono, color: s.hook_score >= 80 ? "#34d399" : s.hook_score >= 60 ? "#fbbf24" : "#f87171", background: s.hook_score >= 80 ? "rgba(52,211,153,0.12)" : s.hook_score >= 60 ? "rgba(251,191,36,0.12)" : "rgba(248,113,113,0.12)" }}>
                      Hook {s.hook_score}/100
                    </span>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => copyScript(s, i)} className="gap-1.5">
                  {copied === i ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === i ? "Copied" : "Copy"}
                </Button>
              </div>

              {s.lines ? (
                <div className="space-y-1.5">
                  {s.lines.map((line: any, li: number) => {
                    const lc = lineColors[line.type] || lineColors.vo;
                    return (
                      <div key={li} className="flex gap-2 items-start">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5" style={{ ...mono, color: lc.color, background: lc.bg }}>
                          {lc.label}
                        </span>
                        <span className="text-sm text-muted-foreground leading-relaxed" style={mono}>{line.text}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed" style={mono}>{s.script || JSON.stringify(s, null, 2)}</pre>
              )}

              {s.notes && (
                <p className="text-xs text-muted-foreground/60 italic pt-1 border-t border-border/30" style={mono}>📝 {s.notes}</p>
              )}

              <div className="flex gap-2 flex-wrap">
                {s.format && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ ...mono, color: "#a78bfa", background: "rgba(167,139,250,0.12)" }}>
                    {s.format}
                  </span>
                )}
                {s.duration && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ ...mono, color: "#60a5fa", background: "rgba(96,165,250,0.12)" }}>
                    {s.duration}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
