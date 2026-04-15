import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { useState, useEffect } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Sparkles, Copy, Check, Target, Users, AlertTriangle, Eye, MessageSquare, BarChart3, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { FeedbackBar } from "@/components/dashboard/FeedbackBar";
import { DESIGN_TOKENS as T } from "@/hooks/useDesignTokens";

const syne = { fontFamily: T.font } as const;
const mono = { fontFamily: T.font } as const;

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
  const [product, setProduct] = useState("");
  const [offer, setOffer] = useState("");
  const [searchParams] = useSearchParams();
  // Pre-fill from AI navigation
  const [objective, setObjective] = useState("conversion");
  const [market, setMarket] = useState(() => language === "pt" ? "BR" : language === "es" ? "MX" : "US");
  const [audience, setAudience] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [personaApplied, setPersonaApplied] = useState(false);


  useEffect(() => {
    const p = searchParams.get("product"); if (p) setProduct(p);
    const o = searchParams.get("offer"); if (o) setOffer(o);
    const m = searchParams.get("market"); if (m) setMarket(m);
    const a = searchParams.get("audience"); if (a) setAudience(a);
    const ctx = searchParams.get("context"); if (ctx) setExtraContext(ctx);
  }, []);

  // Auto-fill from active persona
  useEffect(() => {
    if (!selectedPersona) { setPersonaApplied(false); return; }
    const p = selectedPersona;
    const m = deriveMarket(p.language_style);
    if (m) setMarket(m);

    // Build audience from persona
    const audienceParts = [
      p.age ? `Idade: ${p.age}` : "",
      p.gender ? `Gênero: ${p.gender}` : "",
      p.pains?.length ? `Dores: ${p.pains.join(", ")}` : "",
      p.desires?.length ? `Desejos: ${p.desires.join(", ")}` : "",
    ].filter(Boolean);
    if (audienceParts.length) setAudience(audienceParts.join(". "));

    // Build extra context from persona
    const ctxParts = [
      p.headline ? `Persona: ${p.name} — ${p.headline}` : `Persona: ${p.name}`,
      p.triggers?.length ? `Gatilhos de compra: ${p.triggers.join(", ")}` : "",
      p.hook_angles?.length ? `Ângulos de hook preferidos: ${p.hook_angles.join(", ")}` : "",
      p.cta_style ? `Estilo de CTA: ${p.cta_style}` : "",
      p.language_style ? `Linguagem/tom: ${p.language_style}` : "",
      p.best_platforms?.length ? `Melhores plataformas: ${p.best_platforms.join(", ")}` : "",
      p.best_formats?.length ? `Melhores formatos: ${p.best_formats.join(", ")}` : "",
    ].filter(Boolean);
    if (ctxParts.length) setExtraContext(ctxParts.join("\n"));

    setPersonaApplied(true);
  }, [selectedPersona]);


  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  const generate = async () => {
    if (!product.trim()) { toast.error(language === "pt" ? "Descreva o produto ou serviço primeiro" : language === "es" ? "Describe el producto o servicio primero" : "Please describe the product or service first"); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-brief", {
        body: { product, offer, objective, market, audience, competitors, extra_context: extraContext, user_id: user.id, persona_id: selectedPersona?.id || null },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar brief");
    } finally {
      setLoading(false);
    }
  };

  const copyBrief = () => {
    if (!result?.brief) return;
    const b = result.brief;
    const text = `# ${b.campaign_name}\n\n## Objetivo\n${b.objective}\n\n## Público-Alvo\n${b.target_audience?.demographics}\n${b.target_audience?.psychographics}\nDores: ${b.target_audience?.pain_points?.join(", ")}\nGatilhos: ${b.target_audience?.triggers?.join(", ")}\n\n## Mensagem Central\n${b.core_message}\n\n## Proposta de Valor\n${b.value_proposition}\n\n## Tom & Voz\n${b.tone_and_voice}\n\n## Mensagens-Chave\n${b.key_messages?.map((m: string) => `- ${m}`).join("\n")}\n\n## CTA\n${b.cta}\n\n## Formatos Recomendados\n${b.formats?.map((f: any) => `- ${f.format} (${f.duration}) — ${f.rationale}`).join("\n")}\n\n## Direção Visual\n${b.visual_direction}\n\n## KPIs\n${b.kpis?.map((k: string) => `- ${k}`).join("\n")}\n\n## NÃO Fazer\n${b.do_not?.map((d: string) => `- ${d}`).join("\n")}\n\n## Compliance\n${b.compliance_notes}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const b = result?.brief;

  return (
    <div className="tool-page-wrap max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
          <Sparkles className="h-5 w-5" style={{ color: "#22A3A3" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground" style={syne}>Brief AI</h1>
          <p className="text-sm text-muted-foreground" style={mono}>Prompts completos e detalhados para a IA criar seus anúncios</p>
        </div>
      </div>

      {/* Persona context badge */}
      {personaApplied && selectedPersona && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)" }}>
          <Brain className="h-3.5 w-3.5" style={{ color: "#0ea5e9" }} />
          <span className="text-xs text-muted-foreground" style={mono}>
            Persona <strong className="text-foreground">{selectedPersona.name}</strong> aplicada — público, mercado e contexto preenchidos
          </span>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 p-6 space-y-4" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Produto / Serviço *</label>
          <Textarea placeholder="Descreva o produto, marca ou campanha em detalhes..." value={product} onChange={e => setProduct(e.target.value)} className="min-h-[80px]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Oferta / Promoção (opcional)</label>
            <Input value={offer} onChange={e => setOffer(e.target.value)} placeholder="ex: 50% off, trial grátis, tempo limitado" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Público-Alvo {personaApplied ? "" : "(opcional)"}</label>
            <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="ex: Mulheres 25-34, entusiastas fitness" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Objetivo</label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="awareness">Awareness</SelectItem>
                <SelectItem value="consideration">Consideração</SelectItem>
                <SelectItem value="conversion">Conversão</SelectItem>
                <SelectItem value="retention">Retenção</SelectItem>
                <SelectItem value="installs">Instalações de App</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Mercado</label>
            <Select value={market} onValueChange={setMarket}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="US">🇺🇸 EUA</SelectItem>
                <SelectItem value="BR">🇧🇷 Brasil</SelectItem>
                <SelectItem value="MX">🇲🇽 México</SelectItem>
                <SelectItem value="IN">🇮🇳 Índia</SelectItem>
                <SelectItem value="GLOBAL">🌎 Global</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2 md:col-span-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Concorrentes (opcional)</label>
            <Input value={competitors} onChange={e => setCompetitors(e.target.value)} placeholder="ex: Concorrente A, Concorrente B" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>Contexto Extra {personaApplied ? " (enriquecido pela persona)" : "(opcional)"}</label>
          <Textarea placeholder="Diretrizes de marca, compliance, aprendizados de campanhas anteriores..." value={extraContext} onChange={e => setExtraContext(e.target.value)} className="min-h-[60px]" />
        </div>

        <Button onClick={generate} disabled={loading || !product.trim()} className="w-full gap-2" style={{ background: "linear-gradient(135deg, #22A3A3, #1B8A8A)" }}>
          <Sparkles className="h-4 w-4" />
          {loading ? "Gerando prompts detalhados..." : "Gerar Brief AI"}
        </Button>
      </div>

      {loading && <ThinkingIndicator lang={language as "pt"|"es"|"en"} variant="tool" label="Criando prompt detalhado com IA" />}

      {b && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/50 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground" style={syne}>{b.campaign_name}</h2>
              <Button size="sm" variant="ghost" onClick={copyBrief} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar tudo"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.objective}</p>
          </div>

          {b.target_audience && (
            <div className="rounded-2xl border border-border/50 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: "#0ea5e9" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>Público-Alvo</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm" style={mono}>
                <div>
                  <span className="text-xs text-muted-foreground/60 uppercase">Demografia</span>
                  <p className="text-muted-foreground mt-0.5">{b.target_audience.demographics}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground/60 uppercase">Psicografia</span>
                  <p className="text-muted-foreground mt-0.5">{b.target_audience.psychographics}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground/60 uppercase" style={mono}>Dores</span>
                  <ul className="mt-1 space-y-0.5">{b.target_audience.pain_points?.map((p: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}>• {p}</li>)}</ul>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground/60 uppercase" style={mono}>Gatilhos</span>
                  <ul className="mt-1 space-y-0.5">{b.target_audience.triggers?.map((t: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}>• {t}</li>)}</ul>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" style={{ color: "#06b6d4" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>Mensagem Central</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.core_message}</p>
            </div>
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" style={{ color: "#34d399" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>Proposta de Valor</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.value_proposition}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
            <span className="text-sm font-bold text-foreground" style={syne}>Mensagens-Chave</span>
            <ul className="space-y-1">{b.key_messages?.map((m: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}>→ {m}</li>)}</ul>
            <div className="pt-2 border-t border-border/30">
              <span className="text-xs text-muted-foreground/60 uppercase" style={mono}>CTA</span>
              <p className="text-sm font-semibold text-foreground mt-0.5" style={syne}>"{b.cta}"</p>
            </div>
          </div>

          {b.formats?.length > 0 && (
            <div className="rounded-2xl border border-border/50 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="text-sm font-bold text-foreground" style={syne}>Formatos Recomendados</span>
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
                <span className="text-sm font-bold text-foreground" style={syne}>Direção Visual</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.visual_direction}</p>
            </div>
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="text-sm font-bold text-foreground" style={syne}>Tom & Voz</span>
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
                <span className="text-sm font-bold text-foreground" style={syne}>NÃO Fazer</span>
              </div>
              <ul className="space-y-0.5">{b.do_not?.map((d: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}> {d}</li>)}</ul>
            </div>
          </div>

          {b.compliance_notes && (
            <div className="rounded-xl border border-border/50 p-4 text-xs text-muted-foreground/60" style={{ ...mono, background: "rgba(255,255,255,0.02)" }}>
               {b.compliance_notes}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
            <span className="text-[10px] text-white/40" style={mono}>Este brief foi útil?</span>
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
