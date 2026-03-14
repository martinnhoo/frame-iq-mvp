import { useState, useEffect } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { ClipboardList, Sparkles, Copy, Check, Target, Users, AlertTriangle, Eye, MessageSquare, BarChart3, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";
import { FeedbackBar } from "@/components/dashboard/FeedbackBar";

const syne = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const mono = { fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" } as const;

/** Extract market code from persona language_style like "Brazilian Portuguese" → "BR" */
function deriveMarket(lang?: string): string | null {
  if (!lang) return null;
  const l = lang.toLowerCase();
  if (l.includes("brazil") || l.includes("portugu")) return "BR";
  if (l.includes("mexic") || l.includes("spanish")) return "MX";
  if (l.includes("india")) return "IN";
  if (l.includes("english") && !l.includes("india")) return "US";
  return "GLOBAL";
}

export default function BriefGenerator() {
  const { user, selectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const dt = useDashT(language);
  const [product, setProduct] = useState("");
  const [offer, setOffer] = useState("");
  const [searchParams] = useSearchParams();
  // Pre-fill from AI navigation
  useEffect(() => {
    const p = searchParams.get("product"); if (p) setProduct(p);
    const o = searchParams.get("offer"); if (o) setOffer(o);
    const m = searchParams.get("market"); if (m) setMarket(m);
    const a = searchParams.get("audience"); if (a) setAudience(a);
    const ctx = searchParams.get("context"); if (ctx) setExtraContext(ctx);
  }, []);
  const [objective, setObjective] = useState("conversion");
  const [market, setMarket] = useState("US");
  const [audience, setAudience] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [personaApplied, setPersonaApplied] = useState(false);

  // Auto-fill from active persona
  useEffect(() => {
    if (!selectedPersona) { setPersonaApplied(false); return; }
    const p = selectedPersona;
    const m = deriveMarket(p.language_style);
    if (m) setMarket(m);

    // Build audience from persona
    const audienceParts = [
      p.age ? `Age: ${p.age}` : "",
      p.gender ? `Gender: ${p.gender}` : "",
      p.pains?.length ? `Pain points: ${p.pains.join(", ")}` : "",
      p.desires?.length ? `Desires: ${p.desires.join(", ")}` : "",
    ].filter(Boolean);
    if (audienceParts.length) setAudience(audienceParts.join(". "));

    // Build extra context from persona
    const ctxParts = [
      p.headline ? `Persona: ${p.name} — ${p.headline}` : `Persona: ${p.name}`,
      p.triggers?.length ? `Purchase triggers: ${p.triggers.join(", ")}` : "",
      p.hook_angles?.length ? `Preferred hook angles: ${p.hook_angles.join(", ")}` : "",
      p.cta_style ? `CTA style: ${p.cta_style}` : "",
      p.language_style ? `Language/tone: ${p.language_style}` : "",
      p.best_platforms?.length ? `Best platforms: ${p.best_platforms.join(", ")}` : "",
      p.best_formats?.length ? `Best formats: ${p.best_formats.join(", ")}` : "",
    ].filter(Boolean);
    if (ctxParts.length) setExtraContext(ctxParts.join("\n"));

    setPersonaApplied(true);
  }, [selectedPersona]);

  const generate = async () => {
    if (!product.trim()) { toast.error("Enter a product/service description"); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-brief", {
        body: { product, offer, objective, market, audience, competitors, extra_context: extraContext, user_id: user.id },
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
    const b = result.brief;
    const text = `# ${b.campaign_name}\n\n## Objective\n${b.objective}\n\n## Target Audience\n${b.target_audience?.demographics}\n${b.target_audience?.psychographics}\nPain points: ${b.target_audience?.pain_points?.join(", ")}\nTriggers: ${b.target_audience?.triggers?.join(", ")}\n\n## Core Message\n${b.core_message}\n\n## Value Proposition\n${b.value_proposition}\n\n## Tone & Voice\n${b.tone_and_voice}\n\n## Key Messages\n${b.key_messages?.map((m: string) => `- ${m}`).join("\n")}\n\n## CTA\n${b.cta}\n\n## Formats\n${b.formats?.map((f: any) => `- ${f.format} (${f.duration}) — ${f.rationale}`).join("\n")}\n\n## Visual Direction\n${b.visual_direction}\n\n## KPIs\n${b.kpis?.map((k: string) => `- ${k}`).join("\n")}\n\n## Do NOT\n${b.do_not?.map((d: string) => `- ${d}`).join("\n")}\n\n## Compliance\n${b.compliance_notes}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const b = result?.brief;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(96,165,250,0.15)" }}>
          <ClipboardList className="h-5 w-5" style={{ color: "#60a5fa" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground" style={syne}>{dt("br_title")}</h1>
          <p className="text-sm text-muted-foreground" style={mono}>Production-ready creative briefs in seconds</p>
        </div>
      </div>

      {/* Persona context badge */}
      {personaApplied && selectedPersona && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)" }}>
          <Brain className="h-3.5 w-3.5" style={{ color: "#0ea5e9" }} />
          <span className="text-xs text-muted-foreground" style={mono}>
            Persona <strong className="text-foreground">{selectedPersona.name}</strong> auto-applied — audience, market & context pre-filled
          </span>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 p-6 space-y-4" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Product / Service *</label>
          <Textarea placeholder="Describe your product, brand, or campaign..." value={product} onChange={e => setProduct(e.target.value)} className="min-h-[80px]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Offer / Promotion (optional)</label>
            <Input value={offer} onChange={e => setOffer(e.target.value)} placeholder="e.g. 50% off, free trial, limited time" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Target Audience {personaApplied ? "✓" : "(optional)"}</label>
            <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g. Women 25-34, fitness enthusiasts" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Objective</label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="awareness">Awareness</SelectItem>
                <SelectItem value="consideration">Consideration</SelectItem>
                <SelectItem value="conversion">Conversion</SelectItem>
                <SelectItem value="retention">Retention</SelectItem>
                <SelectItem value="installs">App Installs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Market {personaApplied ? "✓" : ""}</label>
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
          <div className="space-y-2 col-span-2 md:col-span-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Competitors (optional)</label>
            <Input value={competitors} onChange={e => setCompetitors(e.target.value)} placeholder="e.g. Competitor A, Competitor B" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Extra Context {personaApplied ? "✓ (persona enriched)" : "(optional)"}</label>
          <Textarea placeholder="Brand guidelines, compliance rules, past campaign learnings..." value={extraContext} onChange={e => setExtraContext(e.target.value)} className="min-h-[60px]" />
        </div>

        <Button onClick={generate} disabled={loading} className="w-full gap-2" style={{ background: "linear-gradient(135deg, #60a5fa, #0ea5e9)" }}>
          <Sparkles className="h-4 w-4" />
          {loading ? "Generating brief..." : "Generate Creative Brief"}
        </Button>
      </div>

      {b && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/50 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground" style={syne}>{b.campaign_name}</h2>
              <Button size="sm" variant="ghost" onClick={copyBrief} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy All"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.objective}</p>
          </div>

          {b.target_audience && (
            <div className="rounded-2xl border border-border/50 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: "#0ea5e9" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>Target Audience</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm" style={mono}>
                <div>
                  <span className="text-xs text-muted-foreground/60 uppercase">Demographics</span>
                  <p className="text-muted-foreground mt-0.5">{b.target_audience.demographics}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground/60 uppercase">Psychographics</span>
                  <p className="text-muted-foreground mt-0.5">{b.target_audience.psychographics}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground/60 uppercase" style={mono}>Pain Points</span>
                  <ul className="mt-1 space-y-0.5">{b.target_audience.pain_points?.map((p: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}>• {p}</li>)}</ul>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground/60 uppercase" style={mono}>Triggers</span>
                  <ul className="mt-1 space-y-0.5">{b.target_audience.triggers?.map((t: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}>• {t}</li>)}</ul>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" style={{ color: "#06b6d4" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>Core Message</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.core_message}</p>
            </div>
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" style={{ color: "#34d399" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>Value Proposition</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.value_proposition}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
            <span className="text-sm font-bold text-foreground" style={syne}>Key Messages</span>
            <ul className="space-y-1">{b.key_messages?.map((m: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}>→ {m}</li>)}</ul>
            <div className="pt-2 border-t border-border/30">
              <span className="text-xs text-muted-foreground/60 uppercase" style={mono}>CTA</span>
              <p className="text-sm font-semibold text-foreground mt-0.5" style={syne}>"{b.cta}"</p>
            </div>
          </div>

          {b.formats?.length > 0 && (
            <div className="rounded-2xl border border-border/50 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="text-sm font-bold text-foreground" style={syne}>Recommended Formats</span>
              <div className="space-y-2">
                {b.formats.map((f: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ ...mono, color: "#60a5fa", background: "rgba(96,165,250,0.12)" }}>{f.duration}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground" style={syne}>{f.format}</p>
                      <p className="text-xs text-muted-foreground mt-0.5" style={mono}>{f.rationale}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" style={{ color: "#fbbf24" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>Visual Direction</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.visual_direction}</p>
            </div>
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="text-sm font-bold text-foreground" style={syne}>Tone & Voice</span>
              <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.tone_and_voice}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" style={{ color: "#34d399" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>KPIs</span>
              </div>
              <ul className="space-y-0.5">{b.kpis?.map((k: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}>• {k}</li>)}</ul>
            </div>
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" style={{ color: "#f87171" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>Do NOT</span>
              </div>
              <ul className="space-y-0.5">{b.do_not?.map((d: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}>✕ {d}</li>)}</ul>
            </div>
          </div>

          {b.compliance_notes && (
            <div className="rounded-xl border border-border/50 p-4 text-xs text-muted-foreground/60" style={{ ...mono, background: "rgba(255,255,255,0.02)" }}>
              ⚖️ {b.compliance_notes}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
            <span className="text-[10px] text-white/40" style={mono}>Was this brief useful?</span>
            <FeedbackBar
              userId={user.id}
              sourceType="brief"
              outputText={JSON.stringify(b).slice(0, 1000)}
              context={{ objective, market, product: product.slice(0, 100) }}
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
}
