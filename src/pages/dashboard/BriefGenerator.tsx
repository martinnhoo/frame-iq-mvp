import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { ClipboardList, Sparkles, Copy, Check, Target, Users, AlertTriangle, Eye, MessageSquare, BarChart3 } from "lucide-react";
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
const mono = { fontFamily: "'DM Mono', monospace" } as const;

export default function BriefGenerator() {
  const { user } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const dt = useDashT(language);

  const t = {
    subtitle:       language === "pt" ? "Briefs criativos prontos para produção em segundos" : language === "es" ? "Briefs creativos listos para producción en segundos" : "Production-ready creative briefs in seconds",
    product_label:  language === "pt" ? "Produto / Serviço *" : language === "es" ? "Producto / Servicio *" : "Product / Service *",
    product_ph:     language === "pt" ? "Descreva seu produto, marca ou campanha..." : language === "es" ? "Describe tu producto, marca o campaña..." : "Describe your product, brand, or campaign...",
    offer_label:    language === "pt" ? "Oferta / Promoção (opcional)" : language === "es" ? "Oferta / Promoción (opcional)" : "Offer / Promotion (optional)",
    offer_ph:       language === "pt" ? "ex: 50% off, teste grátis, tempo limitado" : language === "es" ? "ej: 50% dto, prueba gratis, tiempo limitado" : "e.g. 50% off, free trial, limited time",
    audience_label: language === "pt" ? "Público-alvo (opcional)" : language === "es" ? "Público objetivo (opcional)" : "Target Audience (optional)",
    audience_ph:    language === "pt" ? "ex: Mulheres 25-34, entusiastas de fitness" : language === "es" ? "ej: Mujeres 25-34, entusiastas del fitness" : "e.g. Women 25-34, fitness enthusiasts",
    objective:      language === "pt" ? "Objetivo" : language === "es" ? "Objetivo" : "Objective",
    awareness:      language === "pt" ? "Reconhecimento" : language === "es" ? "Reconocimiento" : "Awareness",
    consideration:  language === "pt" ? "Consideração" : language === "es" ? "Consideración" : "Consideration",
    conversion:     language === "pt" ? "Conversão" : language === "es" ? "Conversión" : "Conversion",
    retention:      language === "pt" ? "Retenção" : language === "es" ? "Retención" : "Retention",
    installs:       language === "pt" ? "Instalações de App" : language === "es" ? "Instalaciones de App" : "App Installs",
    market:         language === "pt" ? "Mercado" : language === "es" ? "Mercado" : "Market",
    competitors:    language === "pt" ? "Concorrentes (opcional)" : language === "es" ? "Competidores (opcional)" : "Competitors (optional)",
    competitors_ph: language === "pt" ? "ex: Concorrente A, Concorrente B" : language === "es" ? "ej: Competidor A, Competidor B" : "e.g. Competitor A, Competitor B",
    extra_label:    language === "pt" ? "Contexto extra (opcional)" : language === "es" ? "Contexto adicional (opcional)" : "Extra Context (optional)",
    extra_ph:       language === "pt" ? "Diretrizes de marca, regras de compliance, aprendizados de campanhas anteriores..." : language === "es" ? "Directrices de marca, normas de compliance, aprendizajes de campañas anteriores..." : "Brand guidelines, compliance rules, past campaign learnings...",
    generating:     language === "pt" ? "Gerando brief..." : language === "es" ? "Generando brief..." : "Generating brief...",
    generate:       language === "pt" ? "Gerar Brief Criativo" : language === "es" ? "Generar Brief Creativo" : "Generate Creative Brief",
    copy_all:       language === "pt" ? "Copiar tudo" : language === "es" ? "Copiar todo" : "Copy All",
    copied:         language === "pt" ? "Copiado" : language === "es" ? "Copiado" : "Copied",
    s_audience:     language === "pt" ? "Público-alvo" : language === "es" ? "Público objetivo" : "Target Audience",
    demographics:   language === "pt" ? "Dados demográficos" : language === "es" ? "Datos demográficos" : "Demographics",
    psychographics: language === "pt" ? "Psicografia" : language === "es" ? "Psicografía" : "Psychographics",
    pain_points:    language === "pt" ? "Pontos de dor" : language === "es" ? "Puntos de dolor" : "Pain Points",
    triggers:       language === "pt" ? "Gatilhos" : language === "es" ? "Triggers" : "Triggers",
    core_message:   language === "pt" ? "Mensagem principal" : language === "es" ? "Mensaje principal" : "Core Message",
    value_prop:     language === "pt" ? "Proposta de valor" : language === "es" ? "Propuesta de valor" : "Value Proposition",
    key_messages:   language === "pt" ? "Mensagens-chave" : language === "es" ? "Mensajes clave" : "Key Messages",
    rec_formats:    language === "pt" ? "Formatos recomendados" : language === "es" ? "Formatos recomendados" : "Recommended Formats",
    visual_dir:     language === "pt" ? "Direção visual" : language === "es" ? "Dirección visual" : "Visual Direction",
    tone_voice:     language === "pt" ? "Tom & Voz" : language === "es" ? "Tono & Voz" : "Tone & Voice",
    do_not:         language === "pt" ? "NÃO fazer" : language === "es" ? "NO hacer" : "Do NOT",
    was_useful:     language === "pt" ? "Este brief foi útil?" : language === "es" ? "¿Este brief fue útil?" : "Was this brief useful?",
    err_product:    language === "pt" ? "Informe o produto ou serviço" : language === "es" ? "Ingresa el producto o servicio" : "Enter a product/service description",
    err_failed:     language === "pt" ? "Falha ao gerar brief" : language === "es" ? "Error al generar brief" : "Failed to generate brief",
  };

  const [product, setProduct] = useState("");
  const [offer, setOffer] = useState("");
  const [objective, setObjective] = useState("conversion");
  const [market, setMarket] = useState("US");
  const [audience, setAudience] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!product.trim()) { toast.error(t.err_product); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-brief", {
        body: { product, offer, objective, market, audience, competitors, extra_context: extraContext },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || t.err_failed);
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
          <p className="text-sm text-muted-foreground" style={mono}>{t.subtitle}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 p-6 space-y-4" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>{t.product_label}</label>
          <Textarea placeholder={t.product_ph} value={product} onChange={e => setProduct(e.target.value)} className="min-h-[80px]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>{t.offer_label}</label>
            <Input value={offer} onChange={e => setOffer(e.target.value)} placeholder={t.offer_ph} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>{t.audience_label}</label>
            <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder={t.audience_ph} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>{t.objective}</label>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="awareness">{t.awareness}</SelectItem>
                <SelectItem value="consideration">{t.consideration}</SelectItem>
                <SelectItem value="conversion">{t.conversion}</SelectItem>
                <SelectItem value="retention">{t.retention}</SelectItem>
                <SelectItem value="installs">{t.installs}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>{t.market}</label>
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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>{t.competitors}</label>
            <Input value={competitors} onChange={e => setCompetitors(e.target.value)} placeholder={t.competitors_ph} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" style={mono}>{t.extra_label}</label>
          <Textarea placeholder={t.extra_ph} value={extraContext} onChange={e => setExtraContext(e.target.value)} className="min-h-[60px]" />
        </div>

        <Button onClick={generate} disabled={loading} className="w-full gap-2" style={{ background: "linear-gradient(135deg, #60a5fa, #a78bfa)" }}>
          <Sparkles className="h-4 w-4" />
          {loading ? t.generating : t.generate}
        </Button>
      </div>

      {b && (
        <div className="space-y-4">
          {/* Header */}
          <div className="rounded-2xl border border-border/50 p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground" style={syne}>{b.campaign_name}</h2>
              <Button size="sm" variant="ghost" onClick={copyBrief} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t.copied : t.copy_all}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.objective}</p>
          </div>

          {/* Target Audience */}
          {b.target_audience && (
            <div className="rounded-2xl border border-border/50 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: "#a78bfa" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>{t.s_audience}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm" style={mono}>
                <div>
                  <span className="text-xs text-muted-foreground/60 uppercase">{t.demographics}</span>
                  <p className="text-muted-foreground mt-0.5">{b.target_audience.demographics}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground/60 uppercase">{t.psychographics}</span>
                  <p className="text-muted-foreground mt-0.5">{b.target_audience.psychographics}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground/60 uppercase" style={mono}>{t.pain_points}</span>
                  <ul className="mt-1 space-y-0.5">{b.target_audience.pain_points?.map((p: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}>• {p}</li>)}</ul>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground/60 uppercase" style={mono}>{t.triggers}</span>
                  <ul className="mt-1 space-y-0.5">{b.target_audience.triggers?.map((tr: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}>• {tr}</li>)}</ul>
                </div>
              </div>
            </div>
          )}

          {/* Core Message + Value Prop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" style={{ color: "#f472b6" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>{t.core_message}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.core_message}</p>
            </div>
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" style={{ color: "#34d399" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>{t.value_prop}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.value_proposition}</p>
            </div>
          </div>

          {/* Key Messages + CTA */}
          <div className="rounded-2xl border border-border/50 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
            <span className="text-sm font-bold text-foreground" style={syne}>{t.key_messages}</span>
            <ul className="space-y-1">{b.key_messages?.map((msg: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}>→ {msg}</li>)}</ul>
            <div className="pt-2 border-t border-border/30">
              <span className="text-xs text-muted-foreground/60 uppercase" style={mono}>CTA</span>
              <p className="text-sm font-semibold text-foreground mt-0.5" style={syne}>"{b.cta}"</p>
            </div>
          </div>

          {/* Formats */}
          {b.formats?.length > 0 && (
            <div className="rounded-2xl border border-border/50 p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="text-sm font-bold text-foreground" style={syne}>{t.rec_formats}</span>
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

          {/* Visual + Tone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" style={{ color: "#fbbf24" }} />
                <span className="text-sm font-bold text-foreground" style={syne}>{t.visual_dir}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.visual_direction}</p>
            </div>
            <div className="rounded-2xl border border-border/50 p-5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="text-sm font-bold text-foreground" style={syne}>{t.tone_voice}</span>
              <p className="text-sm text-muted-foreground leading-relaxed" style={mono}>{b.tone_and_voice}</p>
            </div>
          </div>

          {/* KPIs + Do Not */}
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
                <span className="text-sm font-bold text-foreground" style={syne}>{t.do_not}</span>
              </div>
              <ul className="space-y-0.5">{b.do_not?.map((d: string, i: number) => <li key={i} className="text-sm text-muted-foreground" style={mono}>✕ {d}</li>)}</ul>
            </div>
          </div>

          {/* Compliance */}
          {b.compliance_notes && (
            <div className="rounded-xl border border-border/50 p-4 text-xs text-muted-foreground/60" style={{ ...mono, background: "rgba(255,255,255,0.02)" }}>
              ⚖️ {b.compliance_notes}
            </div>
          )}

          {/* Feedback */}
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
            <span className="text-[10px] text-white/40" style={mono}>{t.was_useful}</span>
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
