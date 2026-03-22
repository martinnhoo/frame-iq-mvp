import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { Loader2, Zap, Copy, Check, AlertCircle, Target, Crosshair } from "lucide-react";
import { toast } from "sonner";

const F = {fontFamily:"'Plus Jakarta Sans', sans-serif"} as const;
const M = {fontFamily:"'Inter', sans-serif"} as const;

interface Result {
  industry: string; market: string;
  hook_score: number; hook_score_label: string;
  diagnosis: string;
  why_it_works_or_fails: string;
  your_move: string;
  steal_this: string;
  hooks: string[];
  mismatch_detected?: boolean; mismatch_reason?: string;
}

const L: Record<string, Record<string, string>> = {
  pt: {
    title: "Concorrente", sub: "Analise qualquer anúncio como um CS sênior",
    drop: "Arraste um vídeo ou cole o texto do anúncio",
    drop_sub: "Roteiro, legenda, copy — qualquer texto do anúncio serve",
    placeholder: "Cole aqui o roteiro, legenda, copy ou transcrição do anúncio...",
    obs_label: "Observação (opcional)",
    obs_placeholder: "O que você quer entender? A IA vai analisar com isso em mente...",
    btn: "Analisar", analyzing: "Analisando...",
    industry: "Setor / Nicho", market: "Mercado",
    hook: "Score do Hook",
    diagnosis_label: "O que esse anúncio está fazendo",
    why_label: "Por que funciona ou falha",
    move_label: "Sua jogada",
    steal_label: "Roube isso",
    hooks_label: "Hooks para usar agora",
    copy: "Copiar", copied: "Copiado!",
    empty: "Cole qualquer anúncio e receba um briefing de CS sênior",
    empty_sub: "Funciona com copy do Meta Ads, roteiro do TikTok, legenda do YouTube",
    mismatch: "Atenção",
    url_tip: "Dica: para vídeos, use primeiro a ferramenta Traduzir para transcrever.",
  },
  es: {
    title: "Competidor", sub: "Analiza cualquier anuncio como un CS senior",
    drop: "Arrastra un video o pega el texto del anuncio",
    drop_sub: "Guión, subtítulos, copy — cualquier texto del anuncio funciona",
    placeholder: "Pega aquí el guión, subtítulos, copy o transcripción del anuncio...",
    obs_label: "Observación (opcional)",
    obs_placeholder: "¿Qué quieres entender? La IA analizará con esto en mente...",
    btn: "Analizar", analyzing: "Analizando...",
    industry: "Sector / Nicho", market: "Mercado",
    hook: "Score del Hook",
    diagnosis_label: "Lo que está haciendo este anuncio",
    why_label: "Por qué funciona o falla",
    move_label: "Tu jugada",
    steal_label: "Roba esto",
    hooks_label: "Hooks para usar ahora",
    copy: "Copiar", copied: "¡Copiado!",
    empty: "Pega cualquier anuncio y recibe un briefing de CS senior",
    empty_sub: "Funciona con copy de Meta Ads, guión de TikTok, subtítulos de YouTube",
    mismatch: "Atención",
    url_tip: "Tip: para videos, usa primero la herramienta Traducir para transcribir.",
  },
  en: {
    title: "Competitor", sub: "Analyze any ad like a senior CS",
    drop: "Drag a video or paste the ad text",
    drop_sub: "Script, captions, copy — any ad text works",
    placeholder: "Paste the script, captions, copy or transcript here...",
    obs_label: "Observation (optional)",
    obs_placeholder: "What do you want to understand? AI will analyze with this in mind...",
    btn: "Analyze", analyzing: "Analyzing...",
    industry: "Sector / Niche", market: "Market",
    hook: "Hook Score",
    diagnosis_label: "What this ad is doing",
    why_label: "Why it works or fails",
    move_label: "Your move",
    steal_label: "Steal this",
    hooks_label: "Hooks to use now",
    copy: "Copy", copied: "Copied!",
    empty: "Paste any ad and get a senior CS briefing",
    empty_sub: "Works with Meta Ads copy, TikTok script, YouTube captions",
    mismatch: "Note",
    url_tip: "Tip: for videos, use the Translate tool to transcribe first.",
  },
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, score / 10);
  const c = score >= 750 ? "#34d399" : score >= 500 ? "#fbbf24" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div>
        <span style={{ ...F, fontSize: 32, fontWeight: 900, color: c, lineHeight: 1 }}>{score}</span>
        <span style={{ ...M, fontSize: 11, color: "rgba(238,240,246,0.25)" }}>/1000</span>
      </div>
      <div style={{ flex: 1, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, #a78bfa, ${c})`, width: `${pct}%`, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function BriefingSection({ label, content, onCopy, copied }: { label: string; content: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <span style={{ ...M, fontSize: 10, fontWeight: 700, color: "rgba(238,240,246,0.30)", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{label}</span>
        {onCopy && (
          <button onClick={onCopy} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", ...M, fontSize: 10, color: "rgba(238,240,246,0.40)" }}>
            {copied ? <><Check size={9}/> Copiado</> : <><Copy size={9}/> Copiar</>}
          </button>
        )}
      </div>
      <p style={{ ...M, fontSize: 13.5, color: "rgba(238,240,246,0.82)", lineHeight: 1.75, margin: 0 }}>{content}</p>
    </div>
  );
}

export default function CompetitorDecoder() {
  const { selectedPersona } = useOutletContext<DashboardContext>();
  const { language } = useLanguage();
  const lang = (["pt","es","en"].includes(language) ? language : "pt") as "pt"|"es"|"en";
  const t = L[lang];

  const [adText, setAdText] = useState("");
  const [observation, setObservation] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(p => ({ ...p, [key]: true }));
    toast.success(t.copied);
    setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 2000);
  };

  const decode = async (inputText?: string) => {
    const txt = (inputText || adText).trim();
    if (txt.length < 15) { toast.error(lang === "pt" ? "Cole pelo menos uma frase do anúncio" : lang === "es" ? "Pega al menos una frase del anuncio" : "Paste at least one sentence"); return; }
    setLoading(true); setResult(null);
    try {
      const personaCtx = selectedPersona ? `Account: ${selectedPersona.name}.` : undefined;
      const { data, error } = await supabase.functions.invoke("decode-competitor", {
        body: { ad_text: txt, observation: observation.trim() || undefined, persona_context: personaCtx, ui_language: lang },
      });
      if (error) throw error;
      if (data?.error_type === "url_not_supported") { toast.error(data.message); setLoading(false); return; }
      setResult(data);
    } catch { toast.error(lang === "pt" ? "Análise falhou — tente novamente" : "Analysis failed"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ padding: "20px 24px 60px", maxWidth: 720, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.20)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Crosshair size={16} color="#22d3ee" />
        </div>
        <div>
          <h1 style={{ ...F, fontSize: 16, fontWeight: 800, color: "#eef0f6", margin: 0, letterSpacing: "-0.02em" }}>{t.title}</h1>
          <p style={{ ...M, fontSize: 12, color: "rgba(238,240,246,0.38)", marginTop: 1 }}>{t.sub}</p>
        </div>
      </div>

      {/* Input */}
      <div style={{ marginBottom: 12 }}>
        <textarea
          value={adText}
          onChange={e => setAdText(e.target.value)}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); const text = e.dataTransfer.getData("text"); if (text) { setAdText(text); decode(text); } }}
          placeholder={t.placeholder}
          rows={5}
          style={{
            width: "100%", background: isDragging ? "rgba(34,211,238,0.04)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${isDragging ? "rgba(34,211,238,0.40)" : "rgba(255,255,255,0.10)"}`,
            borderRadius: 12, padding: "14px 16px", color: "#eef0f6", ...M, fontSize: 13,
            resize: "vertical" as const, outline: "none", lineHeight: 1.6, boxSizing: "border-box" as const, minHeight: 120,
            transition: "border-color 0.15s",
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(34,211,238,0.35)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
        />
        <p style={{ ...M, fontSize: 10, color: "rgba(238,240,246,0.20)", marginTop: 5 }}>{t.url_tip}</p>
      </div>

      {/* Observation */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ ...M, display: "block", fontSize: 10, fontWeight: 600, color: "rgba(238,240,246,0.28)", letterSpacing: "0.10em", textTransform: "uppercase" as const, marginBottom: 6 }}>{t.obs_label}</label>
        <input value={observation} onChange={e => setObservation(e.target.value)} placeholder={t.obs_placeholder}
          style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 9, padding: "9px 14px", color: "#eef0f6", ...M, fontSize: 13, outline: "none", boxSizing: "border-box" as const }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(34,211,238,0.30)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
        />
      </div>

      {/* Button */}
      <button onClick={() => decode()} disabled={loading || adText.trim().length < 15}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 10, background: loading ? "rgba(34,211,238,0.08)" : adText.trim().length >= 15 ? "#22d3ee" : "rgba(34,211,238,0.06)", border: "none", cursor: adText.trim().length >= 15 && !loading ? "pointer" : "not-allowed", ...F, fontSize: 14, fontWeight: 800, color: loading ? "#22d3ee" : adText.trim().length >= 15 ? "#000" : "rgba(34,211,238,0.25)", marginBottom: 28, transition: "all 0.15s" }}>
        {loading ? <><Loader2 size={15} className="animate-spin" /> {t.analyzing}</> : <><Zap size={15} /> {t.btn}</>}
      </button>

      {loading && <ThinkingIndicator lang={lang} variant="tool" label={lang === "pt" ? "Analisando como CS sênior" : lang === "es" ? "Analizando como CS senior" : "Analyzing as senior CS"} />}

      {/* Result — briefing format */}
      {result && (
        <div>
          {/* Mismatch */}
          {result.mismatch_detected && result.mismatch_reason && (
            <div style={{ display: "flex", gap: 10, padding: "10px 14px", borderRadius: 9, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.20)", marginBottom: 20 }}>
              <AlertCircle size={13} color="#fbbf24" style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ ...M, fontSize: 12, color: "rgba(251,191,36,0.80)", lineHeight: 1.5, margin: 0 }}>{result.mismatch_reason}</p>
            </div>
          )}

          {/* Meta row: industry + score */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div>
              <span style={{ ...M, fontSize: 10, fontWeight: 700, color: "rgba(238,240,246,0.28)", letterSpacing: "0.10em", textTransform: "uppercase" as const, display: "block", marginBottom: 4 }}>{t.industry}</span>
              <span style={{ ...F, fontSize: 13, fontWeight: 700, color: "#eef0f6" }}>{result.industry}</span>
              {result.market && <span style={{ ...M, fontSize: 11, color: "rgba(238,240,246,0.38)", marginLeft: 8 }}>{result.market}</span>}
            </div>
            <div style={{ textAlign: "right" as const, minWidth: 160 }}>
              <span style={{ ...M, fontSize: 10, fontWeight: 700, color: "rgba(238,240,246,0.28)", letterSpacing: "0.10em", textTransform: "uppercase" as const, display: "block", marginBottom: 4 }}>{t.hook}</span>
              <ScoreBar score={result.hook_score} />
              {result.hook_score_label && <span style={{ ...M, fontSize: 10, color: "rgba(238,240,246,0.38)" }}>{result.hook_score_label}</span>}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 22 }} />

          {/* Briefing sections */}
          <BriefingSection label={t.diagnosis_label} content={result.diagnosis} onCopy={() => copy("diag", result.diagnosis)} copied={copied["diag"]} />
          <BriefingSection label={t.why_label} content={result.why_it_works_or_fails} onCopy={() => copy("why", result.why_it_works_or_fails)} copied={copied["why"]} />
          <BriefingSection label={t.move_label} content={result.your_move} onCopy={() => copy("move", result.your_move)} copied={copied["move"]} />

          {/* Steal this — highlighted */}
          <div style={{ marginBottom: 22, padding: "14px 16px", borderRadius: 10, background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Target size={12} color="#22d3ee" />
                <span style={{ ...M, fontSize: 10, fontWeight: 700, color: "rgba(34,211,238,0.55)", letterSpacing: "0.10em", textTransform: "uppercase" as const }}>{t.steal_label}</span>
              </div>
              <button onClick={() => copy("steal", result.steal_this)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 6, background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.20)", cursor: "pointer", ...M, fontSize: 10, color: "#22d3ee" }}>
                {copied["steal"] ? <><Check size={9}/> {t.copied}</> : <><Copy size={9}/> {t.copy}</>}
              </button>
            </div>
            <p style={{ ...M, fontSize: 13.5, color: "rgba(238,240,246,0.82)", lineHeight: 1.75, margin: 0 }}>{result.steal_this}</p>
          </div>

          {/* Hooks */}
          {result.hooks?.length > 0 && (
            <div>
              <span style={{ ...M, fontSize: 10, fontWeight: 700, color: "rgba(238,240,246,0.28)", letterSpacing: "0.12em", textTransform: "uppercase" as const, display: "block", marginBottom: 10 }}>{t.hooks_label}</span>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 7 }}>
                {result.hooks.map((hook, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span style={{ ...M, fontSize: 10, fontWeight: 800, color: "rgba(238,240,246,0.22)", flexShrink: 0, marginTop: 3, minWidth: 14 }}>#{i + 1}</span>
                    <p style={{ ...M, fontSize: 13, color: "rgba(238,240,246,0.85)", lineHeight: 1.55, margin: 0, flex: 1 }}>{hook}</p>
                    <button onClick={() => copy(`hook${i}`, hook)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", ...M, fontSize: 10, color: "rgba(238,240,246,0.45)", flexShrink: 0 }}>
                      {copied[`hook${i}`] ? <><Check size={9}/> {t.copied}</> : <><Copy size={9}/> {t.copy}</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !result && (
        <div style={{ borderRadius: 12, border: "1px dashed rgba(255,255,255,0.08)", padding: "44px 20px", textAlign: "center" as const }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🎯</div>
          <p style={{ ...F, fontSize: 14, fontWeight: 700, color: "rgba(238,240,246,0.38)", margin: "0 0 6px" }}>{t.empty}</p>
          <p style={{ ...M, fontSize: 12, color: "rgba(238,240,246,0.18)", margin: 0 }}>{t.empty_sub}</p>
        </div>
      )}
    </div>
  );
}
